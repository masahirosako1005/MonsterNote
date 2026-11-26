// PUT /v1/admin/accounts/{accountId}/status（BR11.9）。無効化・有効化。
// 自分自身はアプリ層の単純な比較で拒む（422 CANNOT_DISABLE_SELF。security-design.md §2）。
// 無効化は「活動中の管理者が2人以上」を条件にした1つのTransactWriteItemsで行う（数えてから書かない）。
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { TransactWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getCaller, requireRole } from '../shared/auth';
import { isConditionFailure } from '../shared/dynamo';
import { errors } from '../shared/errors';
import { noContent, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import { publishAuditRecorded, type PublishOptions } from '../shared/events';
import type { Logger } from '../shared/logger';
import { adminCounterDecrementItem, adminCounterIncrementItem } from './admin-counter';
import type { AccountsRepository } from './repository';

export interface SetStatusDeps {
  ddb: DynamoDBDocumentClient;
  accountsTable: string;
  adminCounterTable: string;
  accounts: AccountsRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
  publishOptions?: PublishOptions;
}

export function createSetStatusRoute(deps: SetStatusDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（BR11.1〜BR11.3・BR13.3。U4）
    const accountId = event.pathParameters?.accountId;
    if (!accountId) throw errors.notFound();
    const body = parseJsonBody(event);
    const status = body.status;
    if (status !== 'active' && status !== 'disabled') {
      throw errors.validation([{ field: 'status', reason: 'invalid' }]);
    }

    if (status === 'disabled' && accountId === caller.accountId) {
      throw errors.unprocessable('CANNOT_DISABLE_SELF', 'この操作はできません（自分自身）');
    }

    const account = await deps.accounts.getById(accountId);
    if (!account) throw errors.notFound();
    const now = (deps.now ?? (() => new Date()))().toISOString();
    const isAdminTarget = account.role === 'admin';

    if (status === 'disabled') {
      try {
        await deps.ddb.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: deps.accountsTable,
                  Key: { accountId },
                  UpdateExpression: 'SET #s = :disabled',
                  ConditionExpression: '#s = :active',
                  ExpressionAttributeNames: { '#s': 'status' },
                  ExpressionAttributeValues: { ':disabled': 'disabled', ':active': 'active' },
                },
              },
              ...(isAdminTarget ? [adminCounterDecrementItem(deps.adminCounterTable, now)] : []),
            ],
          }),
        );
      } catch (err) {
        if (isConditionFailure(err)) {
          // isAdminTarget のときだけ AdminCounter の条件（活動中2人以上）が加わるため、
          // このケースの条件エラーは「最後の1人」の可能性が高い。それ以外はすでに無効化済み
          if (isAdminTarget) {
            throw errors.unprocessable('LAST_ADMIN', 'この操作はできません（最後の管理者）');
          }
          throw errors.conflict('ALREADY_DISABLED', 'すでに無効です', {});
        }
        throw err;
      }
    } else {
      await deps.ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: deps.accountsTable,
                Key: { accountId },
                UpdateExpression: 'SET #s = :active',
                ConditionExpression: '#s = :disabled',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: { ':active': 'active', ':disabled': 'disabled' },
              },
            },
            ...(isAdminTarget ? [adminCounterIncrementItem(deps.adminCounterTable, now)] : []),
          ],
        }),
      );
    }

    // U4（BR12.5）: 操作の記録。補助的な観測のため、失敗しても主な処理は止めない
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'Accounts',
      {
        action: status === 'disabled' ? 'account.disabled' : 'account.enabled',
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

    return noContent(requestIdOf(event));
  };
}
