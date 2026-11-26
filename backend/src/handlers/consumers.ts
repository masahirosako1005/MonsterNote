// 知らせの受け手の関数の入口（review-on-saved・catalog-on-saved・catalog-on-status・
// duplicate-detection-on-saved・duplicate-detection-on-status）。
// どれも EventBridge のルールから呼ばれる。失敗は例外にして EventBridge のやり直しに任せる。
//
// U3: duplicate.suspected（C14。送り手は U2）も、新しい関数を増やさず既存の catalog-on-status 関数で
// 受ける（infrastructure-specification.md「新しい関数を作らない」。logical-components.md の構成図のとおり、
// ReportCatalog の知らせの受け手として catalog-on-status が duplicate.suspected も受ける）。
// EventBridge のルールで detail-type ごとに振り分けるのではなく、この 1 つの関数の中で
// envelope.type を見て振り分ける（新しい Lambda 関数を作らないため）。
import type { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { createReviewRepository } from '../review/repository';
import { createReviewOnSaved } from '../review/on-saved';
import { createCatalogRepository } from '../catalog/repository';
import { createCatalogOnSaved } from '../catalog/on-saved';
import { createCatalogOnStatus } from '../catalog/on-status';
import { createDuplicateRepository } from '../duplicate-detection/repository';
import { createDuplicateOnSaved } from '../duplicate-detection/on-saved';
import { createDuplicateOnStatus } from '../duplicate-detection/on-status';
import { createCatalogOnDuplicate, type DuplicateSuspectedData } from '../catalog/on-duplicate';
import type { EventEnvelope, ReviewStatusChangedData } from '../shared/events';
import { requireEnv } from '../shared/env';
import { componentIdentity, invokeInternal } from '../shared/internal-invoke';
import { createLogger } from '../shared/logger';
import { createProcessedEvents } from '../shared/processed-events';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const processedTable = () => requireEnv('PROCESSED_EVENTS_TABLE');

/** 関数ごとに必要な表だけを読む（各関数の環境変数には自分の表しか入らない） */
export function reviewOnSavedHandler() {
  return createReviewOnSaved({
    repo: createReviewRepository(ddb, requireEnv('REVIEW_DECISIONS_TABLE')),
    processed: createProcessedEvents(ddb, processedTable(), 'review-on-saved'),
    logger: createLogger('review-on-saved'),
  });
}

export function catalogOnSavedHandler() {
  return createCatalogOnSaved({
    repo: createCatalogRepository(ddb, requireEnv('REPORT_LIST_ITEMS_TABLE')),
    processed: createProcessedEvents(ddb, processedTable(), 'catalog-on-saved'),
    logger: createLogger('catalog-on-saved'),
  });
}

/** catalog-on-status 関数。review.status-changed と duplicate.suspected の両方をここで受ける */
export function catalogOnStatusHandler() {
  const repo = createCatalogRepository(ddb, requireEnv('REPORT_LIST_ITEMS_TABLE'));
  const onStatus = createCatalogOnStatus({
    repo,
    processed: createProcessedEvents(ddb, processedTable(), 'catalog-on-status'),
    logger: createLogger('catalog-on-status'),
  });
  const onDuplicate = createCatalogOnDuplicate({
    repo,
    processed: createProcessedEvents(ddb, processedTable(), 'catalog-on-duplicate'),
    logger: createLogger('catalog-on-duplicate'),
  });
  return async (
    event: EventBridgeEvent<
      string,
      EventEnvelope<ReviewStatusChangedData | DuplicateSuspectedData>
    >,
  ): Promise<void> => {
    if (event.detail?.type === 'duplicate.suspected') {
      await onDuplicate(event as EventBridgeEvent<string, EventEnvelope<DuplicateSuspectedData>>);
      return;
    }
    await onStatus(event as EventBridgeEvent<string, EventEnvelope<ReviewStatusChangedData>>);
  };
}

function duplicateRepoFromEnv() {
  return createDuplicateRepository(ddb, {
    footprints: requireEnv('REPORT_FOOTPRINTS_TABLE'),
    suspicions: requireEnv('DUPLICATE_SUSPICIONS_TABLE'),
  });
}

export function duplicateDetectionOnSavedHandler() {
  const lambda = new LambdaClient({});
  const settingsFunctionName = requireEnv('SETTINGS_FUNCTION_NAME');
  return createDuplicateOnSaved({
    repo: duplicateRepoFromEnv(),
    processed: createProcessedEvents(ddb, processedTable(), 'duplicate-detection-on-saved'),
    logger: createLogger('duplicate-detection-on-saved'),
    // ADR-011 ②: 保存後の再判定は利用者がいないため、部品の身元の証明で Settings を読む
    readSettings: () =>
      invokeInternal(lambda, settingsFunctionName, {
        kind: 'settings-read',
        auth: componentIdentity('DuplicateDetection'),
      }),
    eventBridge: new EventBridgeClient({}),
    busName: requireEnv('EVENT_BUS_NAME'),
  });
}

export function duplicateDetectionOnStatusHandler() {
  return createDuplicateOnStatus({
    repo: duplicateRepoFromEnv(),
    processed: createProcessedEvents(ddb, processedTable(), 'duplicate-detection-on-status'),
    logger: createLogger('duplicate-detection-on-status'),
  });
}
