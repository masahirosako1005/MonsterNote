// 知らせの受け手の関数の入口（review-on-saved・catalog-on-saved・catalog-on-status）。
// どれも EventBridge のルールから呼ばれる。失敗は例外にして EventBridge のやり直しに任せる。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createReviewRepository } from '../review/repository';
import { createReviewOnSaved } from '../review/on-saved';
import { createCatalogRepository } from '../catalog/repository';
import { createCatalogOnSaved } from '../catalog/on-saved';
import { createCatalogOnStatus } from '../catalog/on-status';
import { requireEnv } from '../shared/env';
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

export function catalogOnStatusHandler() {
  return createCatalogOnStatus({
    repo: createCatalogRepository(ddb, requireEnv('REPORT_LIST_ITEMS_TABLE')),
    processed: createProcessedEvents(ddb, processedTable(), 'catalog-on-status'),
    logger: createLogger('catalog-on-status'),
  });
}
