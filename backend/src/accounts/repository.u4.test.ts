// Accounts の表の拡張分の試験（U4: update・list・listPartition の付与）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ACCOUNTS_ALL_PARTITION, createAccountsRepository, type AccountRecord } from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const repo = createAccountsRepository(ddb, 'Accounts');

const account: AccountRecord = {
  accountId: 'req-1',
  loginId: 'city02',
  displayName: '市の担当2',
  role: 'requester',
  organization: 'municipality',
  status: 'active',
  mustChangePassword: true,
  createdAt: '2026-11-25T00:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('create', () => {
  it('listPartition を付けて保存する（一覧の索引用）', async () => {
    ddbMock.on(PutCommand).resolves({});
    await repo.create(account);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call?.args[0].input.Item).toMatchObject({ listPartition: ACCOUNTS_ALL_PARTITION });
  });
});

describe('update', () => {
  it('渡した項目だけを SET する', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await repo.update('req-1', { mustChangePassword: false });
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call?.args[0].input.UpdateExpression).toBe('SET #k0 = :v0');
    expect(call?.args[0].input.ExpressionAttributeNames).toEqual({ '#k0': 'mustChangePassword' });
    expect(call?.args[0].input.ExpressionAttributeValues).toEqual({ ':v0': false });
  });

  it('複数項目も渡せる', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await repo.update('req-1', { consentedAt: '2026-11-25T00:00:00.000Z', hunterNumber: '123' });
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call?.args[0].input.UpdateExpression).toBe('SET #k0 = :v0, #k1 = :v1');
  });

  it('空のパッチでは何も送らない', async () => {
    await repo.update('req-1', {});
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});

describe('list', () => {
  it('gsiAll を固定のパーティションでクエリする（scan ではない。NFR2.1）', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [account] });
    await expect(repo.list()).resolves.toEqual([account]);
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call?.args[0].input.IndexName).toBe('gsiAll');
    expect(call?.args[0].input.ExpressionAttributeValues).toEqual({ ':p': ACCOUNTS_ALL_PARTITION });
  });
});
