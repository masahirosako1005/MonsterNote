// ReportCatalog の関数の入口（C4 の一覧の道）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createCatalogRepository } from '../catalog/repository';
import { createListRoutes } from '../catalog/list';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';

const repo = createCatalogRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  requireEnv('REPORT_LIST_ITEMS_TABLE'),
);

export const handler = createHttpHandler(createListRoutes({ repo }), createLogger('catalog'));
