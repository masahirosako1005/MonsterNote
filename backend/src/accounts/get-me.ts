// GET /v1/me（BR11.7・C1）。ログインの応答と同じ3つの印を返す。初回の手続きの続きを確かめるときに呼ぶ。
import { getCaller } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { AccountsRepository } from './repository';

export interface GetMeDeps {
  accounts: AccountsRepository;
}

export function createGetMeRoute(deps: GetMeDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    const account = await deps.accounts.getById(caller.accountId);
    if (!account) throw errors.notFound();
    const isHunter = account.role === 'hunter';
    return json(
      200,
      {
        accountId: account.accountId,
        role: account.role,
        displayName: account.displayName,
        mustChangePassword: account.mustChangePassword,
        consentRequired: isHunter && !account.consentedAt,
        hunterNumberRequired: isHunter && !account.hunterNumber,
      },
      requestIdOf(event),
    );
  };
}
