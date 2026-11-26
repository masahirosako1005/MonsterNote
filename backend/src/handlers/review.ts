// Review の関数の入口（C3 の状態と承認の道、U4ですべて削除の入口を足す）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { createReviewRepository } from '../review/repository';
import { createDecisionRoutes } from '../review/decision';
import { createGetReviewRoutes } from '../review/get-review';
import { createUndoRoutes } from '../review/undo';
import { createDeleteAllRoute } from '../review/delete-all';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { createRemotePasswordGate } from '../shared/password-gate-client';

const logger = createLogger('review');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = requireEnv('REVIEW_DECISIONS_TABLE');
const repo = createReviewRepository(ddb, tableName);
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');
const lambda = new LambdaClient({});
const accountsFunctionName = requireEnv('ACCOUNTS_FUNCTION_NAME');

export const handler = createHttpHandler(
  {
    ...createDecisionRoutes({ repo, eventBridge, busName, logger }),
    ...createGetReviewRoutes({ repo }),
    ...createUndoRoutes({ repo, eventBridge, busName, logger }),
    'POST /v1/admin/review-data': createDeleteAllRoute({
      ddb,
      tableName,
      eventBridge,
      busName,
      logger,
    }),
  },
  logger,
  { passwordGate: createRemotePasswordGate(lambda, accountsFunctionName) },
);
