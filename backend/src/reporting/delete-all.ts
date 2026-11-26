// POST /v1/admin/detection-data（BR13.1の順番④。DetectionResults）、
// POST /v1/admin/reporting-data（順番⑤。Report・Photo＋S3の写真）。
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DeleteObjectsCommand, type S3Client } from '@aws-sdk/client-s3';
import { ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { batchDeleteAll } from '../shared/batch-delete';
import { getCaller, requireRole } from '../shared/auth';
import { publishAuditRecorded } from '../shared/events';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';

export interface DeleteAllDeps {
  ddb: DynamoDBDocumentClient;
  s3: S3Client;
  bucket: string;
  detectionResultsTable: string;
  reportsTable: string;
  photosTable: string;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
}

async function recordAudit(
  deps: Pick<DeleteAllDeps, 'eventBridge' | 'busName' | 'logger' | 'now'>,
  caller: { accountId: string; name?: string },
  requestId: string,
  componentName: string,
  deletedCount: number,
  extraDetail: Record<string, unknown> = {},
) {
  const now = deps.now ?? (() => new Date());
  const occurredAt = now().toISOString();
  await publishAuditRecorded(
    deps.eventBridge,
    deps.busName,
    'Reporting',
    {
      action: 'data.deleted',
      targetType: 'data',
      outcome: 'succeeded',
      actorAccountId: caller.accountId,
      actorName: caller.name,
      detail: { componentName, deletedCount, ...extraDetail },
    },
    {
      actorAccountId: caller.accountId,
      now: () => new Date(occurredAt),
      newId: () => `${componentName}-data-deleted:${occurredAt}`,
      onError: (err, eventId) =>
        deps.logger.error('audit.recorded を送れなかった', {
          requestId,
          errorCode: 'EVENT_PUBLISH_FAILED',
          eventId,
        }),
    },
  );
}

/** 順番④: DetectionResults（判別の結果） */
export function createDeleteDetectionDataRoute(deps: DeleteAllDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（BR13.3。U4）
    const deletedCount = await batchDeleteAll(deps.ddb, deps.detectionResultsTable, ['photoId']);
    await recordAudit(deps, caller, requestIdOf(event), 'detection', deletedCount);
    deps.logger.info('すべて削除（detection）', { componentName: 'detection', deletedCount });
    return json(200, { deletedCount }, requestIdOf(event));
  };
}

/** S3のDeleteObjectsは1回1000件まで */
const S3_DELETE_BATCH = 1000;

async function deleteAllPhotoObjects(
  ddb: DynamoDBDocumentClient,
  s3: S3Client,
  bucket: string,
  photosTable: string,
): Promise<number> {
  let deleted = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  for (;;) {
    const res = await ddb.send(
      new ScanCommand({
        TableName: photosTable,
        ProjectionExpression: 'photoId, storageKey',
        Limit: S3_DELETE_BATCH,
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );
    const items = (res.Items ?? []) as { photoId: string; storageKey: string }[];
    if (items.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: items.map((i) => ({ Key: i.storageKey })) },
        }),
      );
      deleted += items.length;
    }
    lastEvaluatedKey = res.LastEvaluatedKey;
    if (!lastEvaluatedKey) break;
  }
  return deleted;
}

/** 順番⑤: Report・Photo（DynamoDB）＋写真（S3） */
export function createDeleteReportingDataRoute(deps: DeleteAllDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（BR13.3。U4）
    // 写真の実体（S3）を先に消し、そのあとでPhoto・Reportの表の行を消す
    const photosDeleted = await deleteAllPhotoObjects(
      deps.ddb,
      deps.s3,
      deps.bucket,
      deps.photosTable,
    );
    await batchDeleteAll(deps.ddb, deps.photosTable, ['photoId']);
    const reportsDeleted = await batchDeleteAll(deps.ddb, deps.reportsTable, ['reportId']);
    const deletedCount = reportsDeleted;
    await recordAudit(deps, caller, requestIdOf(event), 'reporting', deletedCount, {
      photosDeleted,
    });
    deps.logger.info('すべて削除（reporting）', { componentName: 'reporting', deletedCount });
    return json(200, { deletedCount }, requestIdOf(event));
  };
}
