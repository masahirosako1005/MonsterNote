// 一覧の絞り込み・読む上限・日数・緯度経度の試験（U3。BR4.5・BR4.7・BR4.8・BR4.9・D-1・D-2）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createListRoutes } from './list';
import { createCatalogRepository, sortKeyOf } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, requesterClaims } from '../../test/helpers/events';
import { clients, fixedNow } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const now = fixedNow('2026-11-23T12:00:00.000Z');
const handler = createHttpHandler(
  createListRoutes({ repo: createCatalogRepository(c.ddb, 'ReportListItems'), now }),
  createLogger('catalog', () => undefined),
);

type Status = 'checking' | 'approved' | 'rejected';

/** 新しい順の n 件の行（i=0 が最新）。status・duplicateSuspected・manualEntry・submittedAt を指定できる */
function rows(
  n: number,
  override: (i: number) => Partial<ReturnType<typeof baseRow>> & { status?: Status } = () => ({}),
) {
  return Array.from({ length: n }, (_, i) => ({ ...baseRow(i), ...override(i) }));
}
function baseRow(i: number) {
  const submittedAt = new Date(Date.UTC(2026, 10, 23, 11, 0, 0) - i * 60_000).toISOString();
  const reportId = `report-${String(1000 - i).padStart(4, '0')}`;
  return {
    reportId,
    hunterAccountId: 'hunter-a',
    hunterName: 'ハンター A',
    species: 'boar' as const,
    capturedAt: submittedAt,
    status: 'checking' as Status,
    duplicateSuspected: false,
    manualEntry: false,
    submittedAt,
    savedReceived: true,
    listPartition: 'ALL',
    sortKey: sortKeyOf(submittedAt, reportId),
  };
}

const list = (query?: Record<string, string>) =>
  handler(
    apiEvent({
      routeKey: 'GET /v1/catalog/reports',
      claims: requesterClaims(),
      queryStringParameters: query,
    }),
  );
const bodyOf = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;

beforeEach(() => ddbMock.reset());

describe('絞り込み（BR4.5）', () => {
  it('status で絞り込み、合う行だけを返す', async () => {
    const all = rows(5, (i) => ({ status: i % 2 === 0 ? 'approved' : 'checking' }));
    ddbMock.on(QueryCommand).resolves({ Items: all });
    const res = await list({ status: 'approved' });
    const b = bodyOf(res);
    const items = b.items as { reportId: string; status: string }[];
    expect(items.every((it) => it.status === 'approved')).toBe(true);
    expect(items).toHaveLength(3);
    expect(b.totalCount).toBe(3);
  });

  it('flag=duplicate で絞り込む', async () => {
    const all = rows(4, (i) => ({ duplicateSuspected: i < 2 }));
    ddbMock.on(QueryCommand).resolves({ Items: all });
    const res = await list({ flag: 'duplicate' });
    expect(bodyOf(res).totalCount).toBe(2);
  });

  it('status と flag の両方を指定すると、両方を満たす行だけ返す（AC4.1.2）', async () => {
    const all = rows(4, (i) => ({
      status: i < 2 ? 'checking' : 'approved',
      duplicateSuspected: i % 2 === 0,
    }));
    ddbMock.on(QueryCommand).resolves({ Items: all });
    const res = await list({ status: 'checking', flag: 'duplicate' });
    const items = bodyOf(res).items as { reportId: string }[];
    // i=0: checking & duplicate=true のみ合致
    expect(items).toHaveLength(1);
  });

  it('知らない値は 400', async () => {
    const res = await list({ status: 'archived' });
    expect(res.statusCode).toBe(400);
  });

  it('合う行が 0 件でも items は空、totalCount は 0', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: rows(3) });
    const res = await list({ status: 'rejected' });
    expect(bodyOf(res)).toMatchObject({ items: [], totalCount: 0 });
  });
});

describe('読む上限（BR4.7・BR4.8・D-1）', () => {
  it('合う行が 50 件を超えたら、50 件と次のページの位置を返す', async () => {
    const all = rows(60);
    // 1 回のクエリ（limit 100）ですべて返る設定
    ddbMock.on(QueryCommand).resolves({ Items: all });
    const res = await list({ status: 'checking' });
    const b = bodyOf(res);
    expect((b.items as unknown[]).length).toBe(50);
    expect(typeof b.nextCursor).toBe('string');
    expect(b.totalCount).toBe(60);
    expect(b.totalCountHasMore).toBeUndefined();
  });

  it('読む上限（2,000 件）に達したら、そこまでの件数と totalCountHasMore を返す', async () => {
    // 2,100 件ぶんの生の行を用意し、バッチ（100件単位）のクエリに応じて順番に返す
    const all = rows(2100);
    let call = 0;
    ddbMock
      .on(QueryCommand)
      .callsFake((input: { Limit: number; ExclusiveStartKey?: { reportId: string } }) => {
        const startIndex = input.ExclusiveStartKey
          ? all.findIndex((r) => r.reportId === input.ExclusiveStartKey!.reportId) + 1
          : 0;
        const slice = all.slice(startIndex, startIndex + input.Limit);
        call += 1;
        return Promise.resolve({ Items: slice });
      });
    const res = await list({ status: 'checking' });
    const b = bodyOf(res);
    expect(b.totalCountHasMore).toBe(true);
    expect(b.totalCount).toBe(2000);
    expect(call).toBeGreaterThan(1);
  });
});

describe('日数の計算（BR4.9）', () => {
  it('確認中の行には daysSinceSubmitted・waitingOverSevenDays を付ける', async () => {
    const submittedAt = '2026-11-15T12:00:00.000Z'; // 2026-11-23T12:00:00 から 8 日
    const all = [{ ...baseRow(0), submittedAt, status: 'checking' as const }];
    ddbMock.on(QueryCommand).resolves({ Items: all });
    const res = await list();
    const item = (bodyOf(res).items as Record<string, unknown>[])[0]!;
    expect(item.daysSinceSubmitted).toBe(8);
    expect(item.waitingOverSevenDays).toBe(true);
  });

  it('確認済みの行には付けない', async () => {
    const all = [{ ...baseRow(0), status: 'approved' as const }];
    ddbMock.on(QueryCommand).resolves({ Items: all });
    const res = await list();
    const item = (bodyOf(res).items as Record<string, unknown>[])[0]!;
    expect(item.daysSinceSubmitted).toBeUndefined();
    expect(item.waitingOverSevenDays).toBeUndefined();
  });
});

describe('緯度・経度（D-2）', () => {
  it('placeName が空のときだけ location を出す', async () => {
    const withPlace = { ...baseRow(0), placeName: '〇〇山' };
    const withoutPlace = { ...baseRow(1), location: { lat: 35, lng: 135 } };
    ddbMock.on(QueryCommand).resolves({ Items: [withPlace, withoutPlace] });
    const res = await list();
    const items = bodyOf(res).items as Record<string, unknown>[];
    expect(items[0]).not.toHaveProperty('location');
    expect(items[1]!.location).toEqual({ lat: 35, lng: 135 });
  });
});
