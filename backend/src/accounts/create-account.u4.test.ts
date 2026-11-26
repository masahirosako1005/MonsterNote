// POST /v1/admin/accounts の試験（BR11.1〜BR11.3）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  createCreateAccountRoute,
  generateTemporaryPassword,
  validateCreateAccountInput,
} from './create-account';
import { createLogger } from '../shared/logger';
import { apiEvent } from '../../test/helpers/events';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const cognito = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const eventBridge = new EventBridgeClient({ region: 'ap-northeast-1' });
const now = () => new Date('2026-11-25T00:00:00.000Z');

const deps = {
  cognito,
  ddb,
  userPoolId: 'pool-1',
  accountsTable: 'Accounts',
  adminCounterTable: 'AdminCounter',
  eventBridge,
  busName: 'monsternote-dev',
  logger: createLogger('accounts', () => undefined),
  now,
  password: () => 'ab3dEf7ghk2m',
};

beforeEach(() => {
  cognitoMock.reset();
  ddbMock.reset();
  ebMock.reset();
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
});

describe('validateCreateAccountInput', () => {
  it('役割・表示名・IDを確かめる', () => {
    expect(
      validateCreateAccountInput({ role: 'hunter', loginId: 'h01', displayName: 'A' }),
    ).toEqual([]);
    expect(validateCreateAccountInput({ role: 'x', loginId: 'h01', displayName: 'A' })).toContain(
      'role',
    );
    expect(
      validateCreateAccountInput({ role: 'hunter', loginId: 'ab', displayName: 'A' }),
    ).toContain('loginId');
  });

  it('依頼元は所属が必須（AC6.1.2）', () => {
    expect(
      validateCreateAccountInput({ role: 'requester', loginId: 'r01', displayName: 'A' }),
    ).toContain('organization');
    expect(
      validateCreateAccountInput({
        role: 'requester',
        loginId: 'r01',
        displayName: 'A',
        organization: 'municipality',
      }),
    ).toEqual([]);
  });
});

describe('generateTemporaryPassword', () => {
  it('12文字で英字と数字を両方含む', () => {
    const p = generateTemporaryPassword();
    expect(p).toHaveLength(12);
    expect(/[a-z]/.test(p)).toBe(true);
    expect(/[0-9]/.test(p)).toBe(true);
  });
});

describe('createCreateAccountRoute', () => {
  it('ハンターを作成し、仮のパスワードを1回だけ返す（AC6.1.1）', async () => {
    cognitoMock
      .on(AdminCreateUserCommand)
      .resolves({ User: { Attributes: [{ Name: 'sub', Value: 'hunter-x' }] } });
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});
    ddbMock.on(TransactWriteCommand).resolves({});
    const route = createCreateAccountRoute(deps);
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/accounts',
        body: { role: 'hunter', loginId: 'hunter09', displayName: 'ハンター9' },
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body ?? '');
    expect(parsed).toEqual({ accountId: 'hunter-x', temporaryPassword: 'ab3dEf7ghk2m' });
    const transact = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems;
    expect(transact).toHaveLength(1); // hunterなのでAdminCounterは触らない
    // U4（BR12.5）: account.created の操作の記録を送る
    const detail = JSON.parse(
      ebMock.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0]?.Detail ?? '{}',
    );
    expect(detail.type).toBe('audit.recorded');
    expect(detail.data).toMatchObject({
      action: 'account.created',
      targetType: 'account',
      targetId: 'hunter-x',
      outcome: 'succeeded',
    });
  });

  it('role=adminのときはAdminCounterも1つのトランザクションで増やす（BR11.2）', async () => {
    cognitoMock
      .on(AdminCreateUserCommand)
      .resolves({ User: { Attributes: [{ Name: 'sub', Value: 'admin-x' }] } });
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});
    ddbMock.on(TransactWriteCommand).resolves({});
    const route = createCreateAccountRoute(deps);
    await route(
      apiEvent({
        routeKey: 'POST /v1/admin/accounts',
        body: { role: 'admin', loginId: 'admin02', displayName: '管理者2' },
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    const transact = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems;
    expect(transact).toHaveLength(2);
  });

  it('依頼元で所属がなければ422', async () => {
    const route = createCreateAccountRoute(deps);
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/accounts',
          body: { role: 'requester', loginId: 'r09', displayName: '担当' },
          claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 422 }));
  });

  it('管理者でなければ403', async () => {
    const route = createCreateAccountRoute(deps);
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/accounts',
          body: { role: 'hunter', loginId: 'hunter09', displayName: 'ハンター9' },
          claims: { sub: 'requester-a', 'cognito:groups': '[requester]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });

  it('IDが重なるとCognitoのUsernameExistsExceptionを409 LOGIN_ID_TAKENにする（AC6.1.3）', async () => {
    const err = new Error('taken');
    err.name = 'UsernameExistsException';
    cognitoMock.on(AdminCreateUserCommand).rejects(err);
    const route = createCreateAccountRoute(deps);
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/accounts',
          body: { role: 'hunter', loginId: 'hunter01', displayName: 'ハンター' },
          claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: 'LOGIN_ID_TAKEN' }));
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});
