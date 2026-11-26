// POST /v1/admin/duplicate-data（BR13.1の順番③）。ReportFootprints・DuplicateSuspicionsの両方を全件消す。
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { batchDeleteAll } from '../shared/batch-delete';
import { getCaller, requireRole } from '../shared/auth';
import { publishAuditRecorded } from '../shared/events';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';

export interface DeleteAllDeps {
  ddb: DynamoDBDocumentClient;
  footprintsTable: string;
  suspicionsTable: string;
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
    const footprints = await batchDeleteAll(deps.ddb, deps.footprintsTable, ['reportId']);
    const suspicions = await batchDeleteAll(deps.ddb, deps.suspicionsTable, ['suspicionId']);
    const deletedCount = footprints + suspicions;
    const occurredAt = now().toISOString();
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'DuplicateDetection',
      {
        action: 'data.deleted',
        targetType: 'data',
        outcome: 'succeeded',
        actorAccountId: caller.accountId,
        actorName: caller.name,
        detail: { componentName: 'duplicate-detection', deletedCount, footprints, suspicions },
      },
      {
        actorAccountId: caller.accountId,
        now: () => new Date(occurredAt),
        newId: () => `duplicate-data-deleted:${occurredAt}`,
        onError: (err, eventId) =>
          deps.logger.error('audit.recorded を送れなかった', {
            requestId: requestIdOf(event),
            errorCode: 'EVENT_PUBLISH_FAILED',
            eventId,
          }),
      },
    );
    deps.logger.info('すべて削除（duplicate-detection）', {
      componentName: 'duplicate-detection',
      deletedCount,
    });
    return json(200, { deletedCount }, requestIdOf(event));
  };
}
