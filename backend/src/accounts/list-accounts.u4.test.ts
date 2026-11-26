// GET /v1/admin/accounts の試験（D-4・reliability-design.md §1の数え直し）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createListAccountsRoute } from './list-accounts';
import { createAccountsRepository, type AccountRecord } from './repository';
import { createAdminCounterRepository } from './admin-counter';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const accounts = createAccountsRepository(ddb, 'Accounts');
const adminCounter = createAdminCounterRepository(ddb, 'AdminCounter');
const now = () => new Date('2026-11-25T00:00:00.000Z');

const admin1: AccountRecord = {
  accountId: 'admin-a',
  loginId: 'admin01',
  displayName: '管理者A',
  role: 'admin',
  status: 'active',
  mustChangePassword: false,
  createdAt: '2026-11-25T00:00:00.000Z',
};
const hunter1: AccountRecord = { ...admin1, accountId: 'hunter-a', role: 'hunter' };

beforeEach(() => ddbMock.reset());

describe('createListAccountsRoute', () => {
  it('role・statusを含めて一覧を返す（D-4）', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [admin1, hunter1] });
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 1 } });
    const route = createListAccountsRoute({ accounts, adminCounter, now });
    const res = await route(
      apiEvent({
        routeKey: 'GET /v1/admin/accounts',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    const body = JSON.parse(res.body ?? '');
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ accountId: 'admin-a', role: 'admin', status: 'active' });
  });

  it('AdminCounterがずれていれば数え直して直す', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [admin1] }); // 実際は1人
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 5 } }); // 記録は5人（ずれている）
    ddbMock.on(UpdateCommand).resolves({});
    const route = createListAccountsRoute({ accounts, adminCounter, now });
    await route(
      apiEvent({
        routeKey: 'GET /v1/admin/accounts',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call?.args[0].input.ExpressionAttributeValues).toMatchObject({ ':count': 1 });
  });

  it('ずれていなければ上書きしない', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [admin1] });
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 1 } });
    const route = createListAccountsRoute({ accounts, adminCounter, now });
    await route(
      apiEvent({
        routeKey: 'GET /v1/admin/accounts',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('管理者でなければ403', async () => {
    const route = createListAccountsRoute({ accounts, adminCounter, now });
    await expect(
      route(
        apiEvent({
          routeKey: 'GET /v1/admin/accounts',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
