// PUT /v1/me/password の試験（BR11.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { createChangePasswordRoute, isValidPassword } from './change-password';
import { createAccountsRepository, type AccountRecord } from './repository';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { apiEvent } from '../../test/helpers/events';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const ddbMock = mockClient(DynamoDBDocumentClient);
const cognito = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
const accounts = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);

const account: AccountRecord = {
  accountId: 'hunter-a',
  loginId: 'hunter01',
  displayName: 'ハンター A',
  role: 'hunter',
  status: 'active',
  mustChangePassword: true,
  createdAt: '2026-11-25T00:00:00.000Z',
};

beforeEach(() => {
  cognitoMock.reset();
  ddbMock.reset();
});

describe('isValidPassword', () => {
  it('8文字以上・英字と数字を含むことを確かめる', () => {
    expect(isValidPassword('abcd1234')).toBe(true);
    expect(isValidPassword('abcdefg1')).toBe(true);
    expect(isValidPassword('abcdefg')).toBe(false); // 数字が無い
    expect(isValidPassword('1234567')).toBe(false); // 7文字・英字が無い
    expect(isValidPassword('ab12')).toBe(false); // 短い
  });
});

describe('createChangePasswordRoute', () => {
  it('正しいパスワードなら Cognito を呼び、mustChangePassword=false にする', async () => {
    ddbMock.on(GetCommand).resolves({ Item: account });
    ddbMock.on(UpdateCommand).resolves({});
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});
    const route = createChangePasswordRoute({
      cognito,
      userPoolId: 'pool-1',
      accounts,
    });
    const res = await route(
      apiEvent({ routeKey: 'PUT /v1/me/password', body: { password: 'abcd1234' } }),
    );
    expect(res.statusCode).toBe(204);
    const call = cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0];
    expect(call?.args[0].input).toMatchObject({
      Username: 'hunter01',
      Password: 'abcd1234',
      Permanent: true,
    });
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0];
    expect(updateCall?.args[0].input.ExpressionAttributeValues).toEqual({ ':v0': false });
  });

  it('規則に合わないパスワードは 422', async () => {
    const route = createChangePasswordRoute({ cognito, userPoolId: 'pool-1', accounts });
    await expect(
      route(apiEvent({ routeKey: 'PUT /v1/me/password', body: { password: 'short' } })),
    ).rejects.toThrow(expect.objectContaining({ status: 422 }));
    expect(cognitoMock.commandCalls(AdminSetUserPasswordCommand)).toHaveLength(0);
  });
});
