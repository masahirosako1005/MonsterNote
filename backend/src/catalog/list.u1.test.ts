// 一覧の試験（BR4.2・BR4.3・BR4.4、AC4.1.1・AC4.1.3・AC4.1.4・AC5.1.1・AC5.1.2・AC5.1.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createListRoutes, decodeCursor, encodeCursor } from './list';
import { createCatalogRepository, sortKeyOf } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const handler = createHttpHandler(
  createListRoutes({ repo: createCatalogRepository(c.ddb, 'ReportListItems') }),
  createLogger('catalog', () => undefined),
);

/** 新しい順の n 件の行（i=0 が最新） */
function rows(n: number, hunter = 'hunter-a') {
  return Array.from({ length: n }, (_, i) => {
    const submittedAt = new Date(Date.UTC(2026, 10, 23, 12, 0, 0) - i * 60_000).toISOString();
    const reportId = `report-${String(n - i).padStart(3, '0')}`;
    return {
      reportId,
      hunterAccountId: hunter,
      hunterName: 'ハンター A',
      species: 'boar',
      capturedAt: submittedAt,
      status: 'checking',
      duplicateSuspected: false,
      manualEntry: false,
      submittedAt,
      savedReceived: true,
      listPartition: 'ALL',
      sortKey: sortKeyOf(submittedAt, reportId),
    };
  });
}

const list = (claims: Record<string, string>, route: string, query?: Record<string, string>) =>
  handler(apiEvent({ routeKey: `GET ${route}`, claims, queryStringParameters: query }));
const bodyOf = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;

beforeEach(() => ddbMock.reset());

describe('GET /v1/catalog/reports（依頼元）', () => {
  it('全件の索引を新しい順に 1 回のクエリで読み、50 件と次のページの位置と全件数を返す', async () => {
    const all = rows(51);
    ddbMock.on(QueryCommand, { Select: 'COUNT' }).resolves({ Count: 51 });
    ddbMock.on(QueryCommand, { IndexName: 'gsiAll', Limit: 51 }).resolves({ Items: all });
    const res = await list(requesterClaims(), '/v1/catalog/reports');
    expect(res.statusCode).toBe(200);
    const b = bodyOf(res);
    const items = b.items as { reportId: string }[];
    expect(items).toHaveLength(50);
    expect(items[0]?.reportId).toBe('report-051');
    expect(b.totalCount).toBe(51);
    expect(typeof b.nextCursor).toBe('string');
    expect(decodeCursor(b.nextCursor as string)).toEqual({
      reportId: all[49]?.reportId,
      sortKey: all[49]?.sortKey,
    });
    const q = ddbMock.commandCalls(QueryCommand).find((call) => call.args[0].input.Limit === 51);
    expect(q?.args[0].input).toMatchObject({
      IndexName: 'gsiAll',
      ScanIndexForward: false,
      ExpressionAttributeValues: { ':pk': 'ALL' },
    });
    // 一覧の行には内部の項目（索引のキー・知らせの時刻）を出さない
    expect(items[0]).not.toHaveProperty('sortKey');
    expect(items[0]).not.toHaveProperty('savedReceived');
  });

  it('cursor を付けると、その行のあとから読む。最後のページの nextCursor は空', async () => {
    const all = rows(51);
    const cursor = encodeCursor({ reportId: all[49]!.reportId, sortKey: all[49]!.sortKey });
    ddbMock.on(QueryCommand, { Select: 'COUNT' }).resolves({ Count: 51 });
    ddbMock.on(QueryCommand, { Limit: 51 }).resolves({ Items: all.slice(50) });
    const res = await list(requesterClaims(), '/v1/catalog/reports', { cursor });
    const b = bodyOf(res);
    expect((b.items as unknown[]).length).toBe(1);
    expect(b.nextCursor).toBeNull();
    const q = ddbMock.commandCalls(QueryCommand).find((call) => call.args[0].input.Limit === 51);
    expect(q?.args[0].input.ExclusiveStartKey).toEqual({
      reportId: all[49]!.reportId,
      sortKey: all[49]!.sortKey,
      listPartition: 'ALL',
    });
  });

  it('0 件なら空の一覧と全件数 0', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });
    const b = bodyOf(await list(requesterClaims(), '/v1/catalog/reports'));
    expect(b).toEqual({ items: [], nextCursor: null, totalCount: 0 });
  });

  it('壊れた cursor は 400', async () => {
    for (const cursor of [
      '%%%',
      Buffer.from('{"x":1}').toString('base64url'),
      Buffer.from('[').toString('base64url'),
    ]) {
      const res = await list(requesterClaims(), '/v1/catalog/reports', { cursor });
      expect(res.statusCode).toBe(400);
    }
  });

  it('ハンターは依頼元の一覧を開けない（403）', async () => {
    expect((await list(hunterClaims(), '/v1/catalog/reports')).statusCode).toBe(403);
  });

  it('U4（D-8）: 管理者も開ける（「すべて削除」の確認画面が件数を見せるため。BR13.2）', async () => {
    ddbMock.on(QueryCommand, { Select: 'COUNT' }).resolves({ Count: 0 });
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const res = await list({ sub: 'admin-a', 'cognito:groups': '[admin]' }, '/v1/catalog/reports');
    expect(res.statusCode).toBe(200);
  });

  it('全件数は索引のページをまたいで数える', async () => {
    ddbMock
      .on(QueryCommand, { Select: 'COUNT' })
      .resolvesOnce({ Count: 2, LastEvaluatedKey: { reportId: 'x' } })
      .resolves({ Count: 3 });
    ddbMock.on(QueryCommand, { Limit: 51 }).resolves({ Items: [] });
    expect(bodyOf(await list(requesterClaims(), '/v1/catalog/reports')).totalCount).toBe(5);
  });
});

describe('GET /v1/catalog/my-reports（ハンター）', () => {
  it('ハンターの索引で、自分の報告だけを新しい順に返す', async () => {
    ddbMock.on(QueryCommand, { Select: 'COUNT' }).resolves({ Count: 3 });
    ddbMock.on(QueryCommand, { Limit: 51 }).resolves({ Items: rows(3) });
    const res = await list(hunterClaims('hunter-a'), '/v1/catalog/my-reports');
    expect(res.statusCode).toBe(200);
    const b = bodyOf(res);
    expect((b.items as { reportId: string }[]).map((r) => r.reportId)).toEqual([
      'report-003',
      'report-002',
      'report-001',
    ]);
    const q = ddbMock.commandCalls(QueryCommand).find((call) => call.args[0].input.Limit === 51);
    expect(q?.args[0].input).toMatchObject({
      IndexName: 'gsiHunter',
      ExpressionAttributeNames: { '#pk': 'hunterAccountId' },
      ExpressionAttributeValues: { ':pk': 'hunter-a' },
    });
  });

  it('cursor のパーティションは利用者本人に固定する（他人の一覧は読めない）', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });
    const cursor = encodeCursor({
      reportId: 'report-9',
      sortKey: '2026-11-23T00:00:00.000Z#report-9',
    });
    await list(hunterClaims('hunter-a'), '/v1/catalog/my-reports', { cursor });
    const q = ddbMock.commandCalls(QueryCommand).find((call) => call.args[0].input.Limit === 51);
    expect(q?.args[0].input.ExclusiveStartKey).toMatchObject({ hunterAccountId: 'hunter-a' });
  });

  it('依頼元はハンターの一覧を使えない（403）', async () => {
    expect((await list(requesterClaims(), '/v1/catalog/my-reports')).statusCode).toBe(403);
  });
});
