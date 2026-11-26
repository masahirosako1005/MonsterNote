// PUT /v1/me/password（BR11.4）。8文字以上・英字と数字を含むこと。変更できたら mustChangePassword=false。
// Cognito 側は AdminSetUserPassword（Permanent=true）を使う。旧パスワードの確認はしない
// （infrastructure-specification.md が accounts 関数に AdminSetUserPassword だけを許可しているため）。
import {
  AdminSetUserPasswordCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { getCaller } from '../shared/auth';
import { errors } from '../shared/errors';
import { noContent, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { AccountsRepository } from './repository';

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export interface ChangePasswordDeps {
  cognito: CognitoIdentityProviderClient;
  userPoolId: string;
  accounts: AccountsRepository;
}

export function createChangePasswordRoute(deps: ChangePasswordDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    const body = parseJsonBody(event);
    const password = body.password;
    if (typeof password !== 'string' || !isValidPassword(password)) {
      // BR11.4 の違反コードは 422 VALIDATION_FAILED（BR11.6 の 400 とは異なる。rules.md のとおり）
      throw errors.unprocessable('VALIDATION_FAILED', '8 文字以上で、英字と数字を含めてください', [
        { field: 'password', reason: 'format' },
      ]);
    }
    const account = await deps.accounts.getById(caller.accountId);
    if (!account) throw errors.notFound();
    await deps.cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: deps.userPoolId,
        Username: account.loginId,
        Password: password,
        Permanent: true,
      }),
    );
    await deps.accounts.update(caller.accountId, { mustChangePassword: false });
    return noContent(requestIdOf(event));
  };
}
