// POST /v1/admin/accounts/{accountId}/password-reset（BR11.3・BR6.2のUC23）。
// 新しい仮のパスワードを作り、mustChangePassword=true に戻す。応答で1回だけ返す。
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import {
  AdminSetUserPasswordCommand,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import { publishAuditRecorded, type PublishOptions } from '../shared/events';
import type { Logger } from '../shared/logger';
import { generateTemporaryPassword } from './create-account';
import type { AccountsRepository } from './repository';

export interface PasswordResetDeps {
  cognito: CognitoIdentityProviderClient;
  userPoolId: string;
  accounts: AccountsRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  password?: () => string;
  now?: () => Date;
  publishOptions?: PublishOptions;
}

export function createPasswordResetRoute(deps: PasswordResetDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（BR11.1〜BR11.3・BR13.3。U4）
    const accountId = event.pathParameters?.accountId;
    if (!accountId) throw errors.notFound();
    const account = await deps.accounts.getById(accountId);
    if (!account) throw errors.notFound();
    const password = (deps.password ?? generateTemporaryPassword)();
    await deps.cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: deps.userPoolId,
        Username: account.loginId,
        Password: password,
        Permanent: true,
      }),
    );
    await deps.accounts.update(accountId, { mustChangePassword: true });

    // U4（BR12.5）: 操作の記録。パスワードそのものは入れない（BR12.3・AC6.6.3）
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'Accounts',
      {
        action: 'account.password-reset',
        targetType: 'account',
        targetId: accountId,
        outcome: 'succeeded',
        actorAccountId: caller.accountId,
        actorName: caller.name,
      },
      {
        actorAccountId: caller.accountId,
        now: deps.now,
        publishOptions: deps.publishOptions,
        onError: (err, eventId) =>
          deps.logger.error('audit.recorded を送れなかった', {
            requestId: requestIdOf(event),
            errorCode: 'EVENT_PUBLISH_FAILED',
            eventId,
          }),
      },
    );

    return json(200, { accountId, temporaryPassword: password }, requestIdOf(event));
  };
}
