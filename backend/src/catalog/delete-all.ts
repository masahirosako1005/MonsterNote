// POST /v1/admin/catalog-data（BR13.1の順番①。試験運用の終わりの削除）。ReportListItemsを全件消す。
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { batchDeleteAll } from '../shared/batch-delete';
import { getCaller, requireRole } from '../shared/auth';
import { publishAuditRecorded } from '../shared/events';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';

export interface DeleteAllDeps {
  ddb: DynamoDBDocumentClient;
  tableName: string;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
}

export function createDeleteAllRoute(deps: DeleteAllDeps): RouteHandler {
  const now = deps.now ?? (() => new Date());
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（BR13.3。U4）
    const deletedCount = await batchDeleteAll(deps.ddb, deps.tableName, ['reportId']);
    const occurredAt = now().toISOString();
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'ReportCatalog',
      {
        action: 'data.deleted',
        targetType: 'data',
        outcome: 'succeeded',
        actorAccountId: caller.accountId,
        actorName: caller.name,
        detail: { componentName: 'catalog', deletedCount },
      },
      {
        actorAccountId: caller.accountId,
        now: () => new Date(occurredAt),
        newId: () => `catalog-data-deleted:${occurredAt}`,
        onError: (err, eventId) =>
          deps.logger.error('audit.recorded を送れなかった', {
            requestId: requestIdOf(event),
            errorCode: 'EVENT_PUBLISH_FAILED',
            eventId,
          }),
      },
    );
    deps.logger.info('すべて削除（catalog）', { componentName: 'catalog', deletedCount });
    return json(200, { deletedCount }, requestIdOf(event));
  };
}
