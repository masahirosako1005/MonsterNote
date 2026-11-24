// Review の関数の入口（C3 の状態と承認の道）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { createReviewRepository } from '../review/repository';
import { createDecisionRoutes } from '../review/decision';
import { createGetReviewRoutes } from '../review/get-review';
import { createUndoRoutes } from '../review/undo';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';

const logger = createLogger('review');
const repo = createReviewRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  requireEnv('REVIEW_DECISIONS_TABLE'),
);
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');

export const handler = createHttpHandler(
  {
    ...createDecisionRoutes({ repo, eventBridge, busName, logger }),
    ...createGetReviewRoutes({ repo }),
    ...createUndoRoutes({ repo, eventBridge, busName, logger }),
  },
  logger,
);
