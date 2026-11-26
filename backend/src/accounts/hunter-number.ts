// PUT /v1/me/hunter-number（BR11.6）。数字 1〜20 桁。空では登録できない。
import { getCaller } from '../shared/auth';
import { errors } from '../shared/errors';
import { noContent, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { AccountsRepository } from './repository';

export function isValidHunterNumber(value: string): boolean {
  return /^[0-9]{1,20}$/.test(value);
}

export interface HunterNumberDeps {
  accounts: AccountsRepository;
}

export function createHunterNumberRoute(deps: HunterNumberDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    const body = parseJsonBody(event);
    const hunterNumber = body.hunterNumber;
    if (typeof hunterNumber !== 'string' || !isValidHunterNumber(hunterNumber)) {
      throw errors.validation(
        [{ field: 'hunterNumber', reason: 'format' }],
        '番号を入れてください',
      );
    }
    await deps.accounts.update(caller.accountId, { hunterNumber });
    return noContent(requestIdOf(event));
  };
}
