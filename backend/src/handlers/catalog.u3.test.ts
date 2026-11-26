// U3: catalog 関数の入口に絞り込みのクエリが届くこと、catalog-on-status 関数が
// duplicate.suspected も受けて振り分けることの試験（handlers/consumers.ts）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { apiEvent, busEvent, requesterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);

const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  REPORT_LIST_ITEMS_TABLE: 'ReportListItems',
  PROCESSED_EVENTS_TABLE: 'ProcessedEvents',
  // U4: すべて削除・mustChangePasswordゲートを足したことに伴う追加の環境変数
  EVENT_BUS_NAME: 'monsternote-dev',
  ACCOUNTS_FUNCTION_NAME: 'accounts-fn',
};

beforeEach(() => {
  ddbMock.reset();
  lambdaMock.reset();
  lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: false }) });
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('catalog 関数の入口', () => {
  it('status・flag の絞り込みクエリを受け付ける', async () => {
    const { handler } = await import('./catalog');
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const res = await handler(
      apiEvent({
        routeKey: 'GET /v1/catalog/reports',
        claims: requesterClaims(),
        queryStringParameters: { status: 'checking', flag: 'duplicate' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toMatchObject({ items: [], totalCount: 0 });
  });

  it('知らない絞り込みの値は 400', async () => {
    const { handler } = await import('./catalog');
    const res = await handler(
      apiEvent({
        routeKey: 'GET /v1/catalog/reports',
        claims: requesterClaims(),
        queryStringParameters: { status: 'archived' },
      }),
    );
    expect(res.statusCode).toBe(400);
  });
});

describe('catalog-on-status 関数の入口（U3: duplicate.suspected も受ける）', () => {
  it('review.status-changed は従来どおり状態を反映する', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(UpdateCommand).resolves({});
    const { handler } = await import('./catalog-on-status');
    await handler(
      busEvent('review.status-changed', {
        eventId: 'e1',
        type: 'review.status-changed',
        version: 1,
        occurredAt: '2026-11-23T04:00:00.000Z',
        source: 'Review',
        data: {
          reportId: 'report-1',
          status: 'approved',
          previousStatus: 'checking',
          changedAt: '2026-11-23T04:00:00.000Z',
        },
      } as never),
    );
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':status': 'approved' });
  });

  it('duplicate.suspected は重複の疑いの印を立てる（新しい関数を作らず、この関数が受ける。BR4.6）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(UpdateCommand).resolves({});
    const { handler } = await import('./catalog-on-status');
    await handler(
      busEvent('duplicate.suspected', {
        eventId: 'e-dup-1',
        type: 'duplicate.suspected',
        version: 1,
        occurredAt: '2026-11-23T05:00:00.000Z',
        source: 'DuplicateDetection',
        data: { reportId: 'report-1', matchedReportId: 'report-9', kind: 'photo' },
      } as never),
    );
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.UpdateExpression).toContain('duplicateSuspected = :true');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':occurredAt': '2026-11-23T05:00:00.000Z',
    });
  });
});
