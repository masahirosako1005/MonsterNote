// PUT /v1/me/consent（BR11.5）。「同意する」で consentedAt、「同意しない」で consentDeclinedAt を記録する。
import { getCaller } from '../shared/auth';
import { errors } from '../shared/errors';
import { noContent, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { AccountsRepository } from './repository';

export interface ConsentDeps {
  accounts: AccountsRepository;
  now?: () => Date;
}

export function createConsentRoute(deps: ConsentDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    const body = parseJsonBody(event);
    if (typeof body.consented !== 'boolean') {
      throw errors.validation([{ field: 'consented', reason: 'required' }]);
    }
    const now = (deps.now ?? (() => new Date()))().toISOString();
    if (body.consented) {
      await deps.accounts.update(caller.accountId, { consentedAt: now });
    } else {
      await deps.accounts.update(caller.accountId, { consentDeclinedAt: now });
    }
    return noContent(requestIdOf(event));
  };
}
