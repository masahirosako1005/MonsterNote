// ログイン・証明の出し直し・ログアウトの試験（BR1.1・BR1.3・BR1.5、AC1.1.1・AC1.1.2・AC1.1.3・AC1.1.5）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  RevokeTokenCommand,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createSessionRoutes } from './session';
import { createAccountsRepository, type AccountRecord } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims } from '../../test/helpers/events';
import { fakeJwt } from '../../test/helpers/jwt';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const ddbMock = mockClient(DynamoDBDocumentClient);
const cognito = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));

const handler = createHttpHandler(
  createSessionRoutes({
    cognito,
    clientId: 'client-1',
    accounts: createAccountsRepository(ddb, 'Accounts'),
  }),
  createLogger('accounts', () => undefined),
);

const hunter: AccountRecord = {
  accountId: 'hunter-a',
  loginId: 'hunter01',
  displayName: 'ハンター A',
  role: 'hunter',
  status: 'active',
  mustChangePassword: false,
  consentedAt: '2026-11-01T00:00:00.000Z',
  hunterNumber: '123',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const tokens = (sub: string, withRefresh = true) => ({
  AuthenticationResult: {
    IdToken: fakeJwt({ sub, 'cognito:groups': ['hunter'] }),
    AccessToken: 'access-token',
    ExpiresIn: 3600,
    ...(withRefresh ? { RefreshToken: 'refresh-token-new' } : {}),
  },
});

const body = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;

beforeEach(() => {
  cognitoMock.reset();
  ddbMock.reset();
});

describe('POST /v1/session（ログイン）', () => {
  it('正しい ID とパスワードなら、証明・出し直し用の値・初回の手続きの状態と役割を返す', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves(tokens('hunter-a'));
    ddbMock.on(GetCommand).resolves({ Item: hunter });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'hunter01', password: 'pass1234' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(body(res)).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token-new',
      expiresIn: 3600,
      mustChangePassword: false,
      consentRequired: false,
      hunterNumberRequired: false,
      account: { accountId: 'hunter-a', role: 'hunter', displayName: 'ハンター A' },
    });
    const input = cognitoMock.commandCalls(InitiateAuthCommand)[0]?.args[0].input;
    expect(input).toMatchObject({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: 'client-1',
      AuthParameters: { USERNAME: 'hunter01', PASSWORD: 'pass1234' },
    });
  });

  it('同意・従事者番号がないハンターは consentRequired・hunterNumberRequired を true で返す', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves(tokens('hunter-b'));
    ddbMock.on(GetCommand).resolves({
      Item: { ...hunter, accountId: 'hunter-b', consentedAt: undefined, hunterNumber: undefined },
    });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'h', password: 'p' },
      }),
    );
    expect(body(res)).toMatchObject({ consentRequired: true, hunterNumberRequired: true });
  });

  it('パスワードが違うと 401「ID かパスワードが違います」（どちらが違うかは言わない）', async () => {
    cognitoMock
      .on(InitiateAuthCommand)
      .rejects(new NotAuthorizedException({ message: 'x', $metadata: {} }));
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'h', password: 'bad' },
      }),
    );
    expect(res.statusCode).toBe(401);
    expect(body(res)).toEqual({ code: 'UNAUTHENTICATED', message: 'ID かパスワードが違います' });
  });

  it('ID がないときも同じ 401 の文', async () => {
    cognitoMock
      .on(InitiateAuthCommand)
      .rejects(new UserNotFoundException({ message: 'x', $metadata: {} }));
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'no', password: 'p' },
      }),
    );
    expect(res.statusCode).toBe(401);
    expect(body(res).message).toBe('ID かパスワードが違います');
  });

  it('無効のアカウントは 401', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves(tokens('hunter-a'));
    ddbMock.on(GetCommand).resolves({ Item: { ...hunter, status: 'disabled' } });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'h', password: 'p' },
      }),
    );
    expect(res.statusCode).toBe(401);
  });

  it('ID・パスワードが空なら 400 で、Cognito を呼ばない', async () => {
    const res = await handler(
      apiEvent({ routeKey: 'POST /v1/session', claims: undefined, body: { loginId: '' } }),
    );
    expect(res.statusCode).toBe(400);
    expect(cognitoMock.commandCalls(InitiateAuthCommand)).toHaveLength(0);
  });

  it('パスワードの変更を求められたアカウント（U1 では作らない）は 401', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ ChallengeName: 'NEW_PASSWORD_REQUIRED' });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'h', password: 'p' },
      }),
    );
    expect(res.statusCode).toBe(401);
  });

  it('Cognito の想定外の失敗は 500', async () => {
    cognitoMock.on(InitiateAuthCommand).rejects(new Error('network'));
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session',
        claims: undefined,
        body: { loginId: 'h', password: 'p' },
      }),
    );
    expect(res.statusCode).toBe(500);
  });
});

describe('POST /v1/session/refresh（証明の出し直し）', () => {
  it('有効な出し直し用の値なら新しい証明と、更新された出し直し用の値を返す', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves(tokens('hunter-a'));
    ddbMock.on(GetCommand).resolves({ Item: hunter });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session/refresh',
        claims: undefined,
        body: { refreshToken: 'refresh-token-old' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(body(res)).toMatchObject({ refreshToken: 'refresh-token-new', expiresIn: 3600 });
    expect(cognitoMock.commandCalls(InitiateAuthCommand)[0]?.args[0].input).toMatchObject({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: 'refresh-token-old' },
    });
  });

  it('更新がない応答なら、送られた出し直し用の値をそのまま返す', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves(tokens('hunter-a', false));
    ddbMock.on(GetCommand).resolves({ Item: hunter });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session/refresh',
        claims: undefined,
        body: { refreshToken: 'keep' },
      }),
    );
    expect(body(res).refreshToken).toBe('keep');
  });

  it('30 日切れ・ログアウト済み・無効の値は 401', async () => {
    cognitoMock
      .on(InitiateAuthCommand)
      .rejects(new NotAuthorizedException({ message: 'expired', $metadata: {} }));
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session/refresh',
        claims: undefined,
        body: { refreshToken: 'old' },
      }),
    );
    expect(res.statusCode).toBe(401);
  });

  it('出し直し用の値がなければ 400', async () => {
    const res = await handler(
      apiEvent({ routeKey: 'POST /v1/session/refresh', claims: undefined, body: {} }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('無効にしたアカウントには出し直さない（401）', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves(tokens('hunter-a'));
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/session/refresh',
        claims: undefined,
        body: { refreshToken: 'x' },
      }),
    );
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /v1/session（ログアウト）', () => {
  it('RevokeToken で出し直し用の値を無効にし、204', async () => {
    cognitoMock.on(RevokeTokenCommand).resolves({});
    const res = await handler(
      apiEvent({
        routeKey: 'DELETE /v1/session',
        claims: hunterClaims(),
        body: { refreshToken: 'rt' },
      }),
    );
    expect(res.statusCode).toBe(204);
    expect(cognitoMock.commandCalls(RevokeTokenCommand)[0]?.args[0].input).toEqual({
      Token: 'rt',
      ClientId: 'client-1',
    });
  });

  it('すでに無効な値でも 204（ログアウトの目的は果たしている）', async () => {
    cognitoMock
      .on(RevokeTokenCommand)
      .rejects(new NotAuthorizedException({ message: 'x', $metadata: {} }));
    const res = await handler(
      apiEvent({
        routeKey: 'DELETE /v1/session',
        claims: hunterClaims(),
        body: { refreshToken: 'rt' },
      }),
    );
    expect(res.statusCode).toBe(204);
  });

  it('証明がなければ 401、出し直し用の値がなければ 400', async () => {
    const noAuth = await handler(
      apiEvent({ routeKey: 'DELETE /v1/session', claims: undefined, body: { refreshToken: 'rt' } }),
    );
    expect(noAuth.statusCode).toBe(401);
    const noToken = await handler(
      apiEvent({ routeKey: 'DELETE /v1/session', claims: hunterClaims(), body: {} }),
    );
    expect(noToken.statusCode).toBe(400);
  });

  it('想定外の失敗は 500（黙って成功にしない）', async () => {
    cognitoMock.on(RevokeTokenCommand).rejects(new Error('network'));
    const res = await handler(
      apiEvent({
        routeKey: 'DELETE /v1/session',
        claims: hunterClaims(),
        body: { refreshToken: 'rt' },
      }),
    );
    expect(res.statusCode).toBe(500);
  });
});
