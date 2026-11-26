// caller-status の内部の呼び出しの試験（U4・BR11.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { checkCallerStatus, isCallerStatusRequest } from './caller-status';
import { createAccountsRepository, type AccountRecord } from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);

const account: AccountRecord = {
  accountId: 'req-1',
  loginId: 'city02',
  displayName: '市の担当2',
  role: 'requester',
  status: 'active',
  mustChangePassword: true,
  createdAt: '2026-11-25T00:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('checkCallerStatus', () => {
  it('mustChangePassword をそのまま返す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: account });
    await expect(
      checkCallerStatus(repo, {
        kind: 'caller-status',
        caller: { sub: 'req-1', roles: ['requester'] },
      }),
    ).resolves.toEqual({ mustChangePassword: true });
  });

  it('アカウントが無ければ false（この確認の対象外）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(
      checkCallerStatus(repo, { kind: 'caller-status', caller: { sub: 'x', roles: [] } }),
    ).resolves.toEqual({ mustChangePassword: false });
  });
});

describe('isCallerStatusRequest', () => {
  it('直接の呼び出しの形を見分ける', () => {
    expect(isCallerStatusRequest({ kind: 'caller-status', caller: { sub: 'a', roles: [] } })).toBe(
      true,
    );
    expect(isCallerStatusRequest({ requestContext: {} })).toBe(false);
  });
});
