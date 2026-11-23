// ログイン・証明の出し直し・ログアウト（C1、BR1.1・BR1.3・BR1.5、security-design）。
// 画面は Cognito を直接呼ばず、この API を通す。Cognito の InitiateAuth と RevokeToken を呼ぶ。
import {
  InitiateAuthCommand,
  RevokeTokenCommand,
  type AuthenticationResultType,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { getCaller } from '../shared/auth';
import { AppError, errors } from '../shared/errors';
import { json, noContent, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { AccountRecord, AccountsRepository } from './repository';

export interface SessionDeps {
  cognito: CognitoIdentityProviderClient;
  clientId: string;
  accounts: AccountsRepository;
}

const LOGIN_FAILED = 'ID かパスワードが違います';
const REFRESH_FAILED = 'もう一度ログインしてください';

/** Cognito が「認証に失敗した」と返す例外の名前 */
const AUTH_FAILURES = new Set([
  'NotAuthorizedException',
  'UserNotFoundException',
  'UserNotConfirmedException',
  'PasswordResetRequiredException',
]);

function isAuthFailure(err: unknown): boolean {
  return err instanceof Error && AUTH_FAILURES.has(err.name);
}

/** Cognito から直接受け取った ID トークンの中身を読む（署名の確認は不要: 呼び出しの相手が Cognito のため） */
function subOf(idToken: string | undefined): string | undefined {
  const payload = idToken?.split('.')[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
    };
    return typeof claims.sub === 'string' ? claims.sub : undefined;
  } catch {
    return undefined;
  }
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw errors.validation([{ field, reason: 'required' }], '入れてください');
  }
  return value;
}

function accountView(account: AccountRecord) {
  return {
    accountId: account.accountId,
    role: account.role,
    displayName: account.displayName,
    ...(account.organization ? { organization: account.organization } : {}),
  };
}

export function createSessionRoutes(deps: SessionDeps): Record<string, RouteHandler> {
  /** 証明から有効なアカウントを読む。なければ・無効なら 401 */
  async function activeAccount(
    result: AuthenticationResultType | undefined,
    failMessage: string,
  ): Promise<AccountRecord> {
    const sub = subOf(result?.IdToken);
    if (!sub) throw errors.unauthenticated(failMessage);
    const account = await deps.accounts.getById(sub);
    if (!account || account.status !== 'active') throw errors.unauthenticated(failMessage);
    return account;
  }

  async function initiate(
    flow: 'USER_PASSWORD_AUTH' | 'REFRESH_TOKEN_AUTH',
    params: Record<string, string>,
    failMessage: string,
  ): Promise<AuthenticationResultType> {
    try {
      const res = await deps.cognito.send(
        new InitiateAuthCommand({
          AuthFlow: flow,
          ClientId: deps.clientId,
          AuthParameters: params,
        }),
      );
      // U1 ではパスワードの変更などの追加の手続き（challenge）を求めるアカウントを作らない
      if (!res.AuthenticationResult) throw errors.unauthenticated(failMessage);
      return res.AuthenticationResult;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isAuthFailure(err)) throw errors.unauthenticated(failMessage);
      throw err;
    }
  }

  return {
    // BR1.1 ログイン
    'POST /v1/session': async (event) => {
      const body = parseJsonBody(event);
      const loginId = requireString(body, 'loginId');
      const password = requireString(body, 'password');
      const result = await initiate(
        'USER_PASSWORD_AUTH',
        { USERNAME: loginId, PASSWORD: password },
        LOGIN_FAILED,
      );
      const account = await activeAccount(result, LOGIN_FAILED);
      const isHunter = account.role === 'hunter';
      return json(
        200,
        {
          idToken: result.IdToken,
          accessToken: result.AccessToken,
          refreshToken: result.RefreshToken,
          expiresIn: result.ExpiresIn,
          account: accountView(account),
          mustChangePassword: account.mustChangePassword,
          consentRequired: isHunter && !account.consentedAt,
          hunterNumberRequired: isHunter && !account.hunterNumber,
        },
        requestIdOf(event),
      );
    },

    // BR1.5 証明の出し直し。リフレッシュトークンの更新（rotation）で期限は最後の利用から 30 日になる
    'POST /v1/session/refresh': async (event) => {
      const body = parseJsonBody(event);
      const refreshToken = requireString(body, 'refreshToken');
      const result = await initiate(
        'REFRESH_TOKEN_AUTH',
        { REFRESH_TOKEN: refreshToken },
        REFRESH_FAILED,
      );
      const account = await activeAccount(result, REFRESH_FAILED);
      return json(
        200,
        {
          idToken: result.IdToken,
          accessToken: result.AccessToken,
          refreshToken: result.RefreshToken ?? refreshToken,
          expiresIn: result.ExpiresIn,
          account: accountView(account),
        },
        requestIdOf(event),
      );
    },

    // BR1.3 ログアウト。出し直し用の値も無効にする
    'DELETE /v1/session': async (event) => {
      getCaller(event);
      const body = parseJsonBody(event);
      const refreshToken = requireString(body, 'refreshToken');
      try {
        await deps.cognito.send(
          new RevokeTokenCommand({ Token: refreshToken, ClientId: deps.clientId }),
        );
      } catch (err) {
        // すでに無効な値なら、ログアウトの目的は果たしている
        if (!isAuthFailure(err)) throw err;
      }
      return noContent(requestIdOf(event));
    },
  };
}
