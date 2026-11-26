// ReportCatalog の関数の入口（C4 の一覧の道、U4ですべて削除の入口を足す）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { createCatalogRepository } from '../catalog/repository';
import { createListRoutes } from '../catalog/list';
import { createDeleteAllRoute } from '../catalog/delete-all';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { createRemotePasswordGate } from '../shared/password-gate-client';

const logger = createLogger('catalog');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = requireEnv('REPORT_LIST_ITEMS_TABLE');
const repo = createCatalogRepository(ddb, tableName);
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');
const lambda = new LambdaClient({});
const accountsFunctionName = requireEnv('ACCOUNTS_FUNCTION_NAME');

export const handler = createHttpHandler(
  {
    ...createListRoutes({ repo }),
    'POST /v1/admin/catalog-data': createDeleteAllRoute({
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
