// U4: 新しい関数（accounts の新しい道・audit-log）の入口の配線と、
// mustChangePasswordゲートが実際にブロックすることのエンドツーエンドの試験
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { apiEvent, busEvent, requesterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const lambdaMock = mockClient(LambdaClient);

const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  ACCOUNTS_TABLE: 'Accounts',
  ADMIN_COUNTER_TABLE: 'AdminCounter',
  USER_POOL_CLIENT_ID: 'client-1',
  USER_POOL_ID: 'pool-1',
  REVIEW_DECISIONS_TABLE: 'ReviewDecisions',
  EVENT_BUS_NAME: 'monsternote-dev',
  ACCOUNTS_FUNCTION_NAME: 'accounts-fn',
  AUDIT_ENTRIES_TABLE: 'AuditEntries',
};

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  lambdaMock.reset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('accounts: U4の新しい道とcaller-statusの内部の呼び出し', () => {
  it('caller-statusの直接の呼び出しを受ける', async () => {
    const { handler } = await import('./accounts');
    ddbMock.on(GetCommand).resolves({ Item: { mustChangePassword: true } });
    await expect(
      handler({ kind: 'caller-status', caller: { sub: 'req-1', roles: ['requester'] } }),
    ).resolves.toEqual({ mustChangePassword: true });
  });

  it('GET /v1/me の道を持つ', async () => {
    const { handler } = await import('./accounts');
    ddbMock.on(GetCommand).resolves({
      Item: {
        accountId: 'hunter-a',
        loginId: 'hunter01',
        displayName: 'A',
        role: 'hunter',
        status: 'active',
        mustChangePassword: false,
        consentedAt: 'x',
        hunterNumber: '1',
        createdAt: 'x',
      },
    });
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/me',
        claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
      }),
    )) as { statusCode: number };
    expect(res.statusCode).toBe(200);
  });

  it('GET /v1/admin/accounts の道を持つ（一覧）', async () => {
    const { handler } = await import('./accounts');
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 0 } });
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/admin/accounts',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    )) as { statusCode: number };
    expect(res.statusCode).toBe(200);
  });
});

describe('audit-log: HTTPの道とEventBridgeの受け手を見分ける', () => {
  it('GET /v1/admin/audit-entries はHTTPの道', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: false }) });
    const { handler } = await import('./audit-log');
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/admin/audit-entries',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    )) as { statusCode: number };
    expect(res.statusCode).toBe(200);
  });

  it('仮のパスワードのままの管理者は403 PASSWORD_CHANGE_REQUIRED（レビューで発見。passwordGateの抜け）', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: true }) });
    const { handler } = await import('./audit-log');
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/admin/audit-entries',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    )) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('audit.recordedのEventBridgeの知らせを受ける', async () => {
    const { handler } = await import('./audit-log');
    ddbMock.on(PutCommand).resolves({});
    await expect(
      handler(
        busEvent('audit.recorded', {
          eventId: 'event-1',
          type: 'audit.recorded',
          version: 1,
          occurredAt: '2026-11-25T00:00:00.000Z',
          source: 'Review',
          data: { action: 'review.approved', targetType: 'report', outcome: 'succeeded' },
        }),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('mustChangePasswordゲート: 実際にreview関数をブロックする（エンドツーエンド）', () => {
  it('仮のパスワードのままだと403 PASSWORD_CHANGE_REQUIRED', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: true }) });
    const { handler } = await import('./review');
    const res = (await handler(
      apiEvent({
        routeKey: 'PUT /v1/reviews/{reportId}/decision',
        claims: requesterClaims(),
        pathParameters: { reportId: 'r1' },
        body: { decision: 'approved' },
      }),
    )) as { statusCode: number };
    expect(res.statusCode).toBe(403);
    const body = JSON.parse((res as unknown as { body: string }).body);
    expect(body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('mustChangePassword=falseなら通常どおり処理する', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: false }) });
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const { handler } = await import('./review');
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/reviews/{reportId}',
        claims: requesterClaims(),
        pathParameters: { reportId: 'r1' },
      }),
    )) as { statusCode: number };
    // REVIEW_NOT_READYの404は「ゲートを通過してビジネスロジックに到達した」ことの証拠
    expect(res.statusCode).toBe(404);
  });
});
