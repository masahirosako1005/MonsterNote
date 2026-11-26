// POST /v1/admin/accounts/{accountId}/password-reset の試験（BR11.3）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createPasswordResetRoute } from './password-reset';
import { createAccountsRepository, type AccountRecord } from './repository';
import { createLogger } from '../shared/logger';
import { apiEvent } from '../../test/helpers/events';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const cognito = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
const eventBridge = new EventBridgeClient({ region: 'ap-northeast-1' });
const accounts = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);
const eventDeps = {
  eventBridge,
  busName: 'monsternote-dev',
  logger: createLogger('accounts', () => undefined),
};

const account: AccountRecord = {
  accountId: 'req-1',
  loginId: 'city02',
  displayName: '市の担当2',
  role: 'requester',
  status: 'active',
  mustChangePassword: false,
  createdAt: '2026-11-25T00:00:00.000Z',
};

const adminClaims = { sub: 'admin-a', 'cognito:groups': '[admin]' };

beforeEach(() => {
  cognitoMock.reset();
  ddbMock.reset();
  ebMock.reset();
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
});

describe('createPasswordResetRoute', () => {
  it('新しい仮のパスワードを発行し、mustChangePassword=true に戻す（AC6.2.1・AC6.2.2）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: account });
    ddbMock.on(UpdateCommand).resolves({});
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});
    const route = createPasswordResetRoute({
      cognito,
      userPoolId: 'pool-1',
      accounts,
      password: () => 'newpass123',
      ...eventDeps,
    });
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/accounts/{accountId}/password-reset',
        pathParameters: { accountId: 'req-1' },
        claims: adminClaims,
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '')).toEqual({
      accountId: 'req-1',
      temporaryPassword: 'newpass123',
    });
    expect(cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0]?.args[0].input).toMatchObject({
      Username: 'city02',
      Permanent: true,
    });
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeValues).toEqual(
      {
        ':v0': true,
      },
    );
    // U4（BR12.5）: account.password-reset の操作の記録を送る
    const detail = JSON.parse(
      ebMock.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0]?.Detail ?? '{}',
    );
    expect(detail.data).toMatchObject({
      action: 'account.password-reset',
      targetType: 'account',
      targetId: 'req-1',
      outcome: 'succeeded',
    });
  });

  it('アカウントが無ければ404', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const route = createPasswordResetRoute({
      cognito,
      userPoolId: 'pool-1',
      accounts,
      ...eventDeps,
    });
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/accounts/{accountId}/password-reset',
          pathParameters: { accountId: 'none' },
          claims: adminClaims,
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404 }));
  });

  it('管理者でなければ403', async () => {
    const route = createPasswordResetRoute({
      cognito,
      userPoolId: 'pool-1',
      accounts,
      ...eventDeps,
    });
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/accounts/{accountId}/password-reset',
          pathParameters: { accountId: 'req-1' },
          claims: { sub: 'requester-a', 'cognito:groups': '[requester]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
