// PUT /v1/admin/accounts/{accountId}/status の試験（BR11.9）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createSetStatusRoute } from './set-status';
import { createAccountsRepository, type AccountRecord } from './repository';
import { createLogger } from '../shared/logger';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const eventBridge = new EventBridgeClient({ region: 'ap-northeast-1' });
const accounts = createAccountsRepository(ddb, 'Accounts');
const now = () => new Date('2026-11-25T00:00:00.000Z');

const deps = {
  ddb,
  accountsTable: 'Accounts',
  adminCounterTable: 'AdminCounter',
  accounts,
  now,
  eventBridge,
  busName: 'monsternote-dev',
  logger: createLogger('accounts', () => undefined),
};

const adminTarget: AccountRecord = {
  accountId: 'admin-b',
  loginId: 'admin02',
  displayName: '管理者B',
  role: 'admin',
  status: 'active',
  mustChangePassword: false,
  createdAt: '2026-11-25T00:00:00.000Z',
};

const requesterTarget: AccountRecord = { ...adminTarget, accountId: 'req-1', role: 'requester' };

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
});

const event = (overrides: { status: string; accountId: string; callerId?: string }) =>
  apiEvent({
    routeKey: 'PUT /v1/admin/accounts/{accountId}/status',
    pathParameters: { accountId: overrides.accountId },
    body: { status: overrides.status },
    claims: { sub: overrides.callerId ?? 'admin-a', 'cognito:groups': '[admin]' },
  });

describe('createSetStatusRoute', () => {
  it('自分自身は無効にできない（422 CANNOT_DISABLE_SELF）', async () => {
    const route = createSetStatusRoute(deps);
    await expect(
      route(event({ status: 'disabled', accountId: 'admin-a', callerId: 'admin-a' })),
    ).rejects.toThrow(expect.objectContaining({ status: 422, code: 'CANNOT_DISABLE_SELF' }));
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('管理者を無効にすると、AdminCounterの条件付き-1を同じトランザクションで行う', async () => {
    ddbMock.on(GetCommand).resolves({ Item: adminTarget });
    ddbMock.on(TransactWriteCommand).resolves({});
    const route = createSetStatusRoute(deps);
    const res = await route(event({ status: 'disabled', accountId: 'admin-b' }));
    expect(res.statusCode).toBe(204);
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems;
    expect(items).toHaveLength(2);
  });

  it('最後の管理者は422 LAST_ADMIN（AdminCounterの条件で失敗）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: adminTarget });
    ddbMock
      .on(TransactWriteCommand)
      .rejects(
        new TransactionCanceledException({ message: 'x', $metadata: {}, CancellationReasons: [] }),
      );
    const route = createSetStatusRoute(deps);
    await expect(route(event({ status: 'disabled', accountId: 'admin-b' }))).rejects.toThrow(
      expect.objectContaining({ status: 422, code: 'LAST_ADMIN' }),
    );
  });

  it('依頼元・ハンターの無効化はAdminCounterに触れない（1項目だけ）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: requesterTarget });
    ddbMock.on(TransactWriteCommand).resolves({});
    const route = createSetStatusRoute(deps);
    await route(event({ status: 'disabled', accountId: 'req-1' }));
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems;
    expect(items).toHaveLength(1);
  });

  it('有効に戻すと、管理者ならAdminCounterを+1する（AC6.3.4）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...adminTarget, status: 'disabled' } });
    ddbMock.on(TransactWriteCommand).resolves({});
    const route = createSetStatusRoute(deps);
    const res = await route(event({ status: 'active', accountId: 'admin-b' }));
    expect(res.statusCode).toBe(204);
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems;
    expect(items).toHaveLength(2);
  });

  it('不正な status 値は検証エラー', async () => {
    const route = createSetStatusRoute(deps);
    await expect(route(event({ status: 'bogus', accountId: 'admin-b' }))).rejects.toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('管理者でなければ403', async () => {
    const route = createSetStatusRoute(deps);
    await expect(
      route(
        apiEvent({
          routeKey: 'PUT /v1/admin/accounts/{accountId}/status',
          pathParameters: { accountId: 'admin-b' },
          body: { status: 'disabled' },
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
