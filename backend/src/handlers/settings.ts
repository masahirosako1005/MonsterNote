// Settings の関数の入口。内部の呼び出し（Reporting・DuplicateDetectionからの読み出し専用）に加え、
// U4でAPI Gatewayの道（管理者の設定の読み書き）を足す。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { createSettingsRepository } from '../settings/repository';
import { isSettingsReadRequest, readSettings } from '../settings/internal';
import { createGetSettingsRoute } from '../settings/get-settings';
import { createUpdateSettingsRoute } from '../settings/update-settings';
import { requireEnv } from '../shared/env';
import { createHttpHandler, type HttpEvent } from '../shared/http';
import { createLogger } from '../shared/logger';
import { createRemotePasswordGate } from '../shared/password-gate-client';

const logger = createLogger('settings');
const repo = createSettingsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  requireEnv('SETTINGS_TABLE'),
);
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');
const lambda = new LambdaClient({});
const accountsFunctionName = requireEnv('ACCOUNTS_FUNCTION_NAME');

const http = createHttpHandler(
  {
    'GET /v1/admin/settings': createGetSettingsRoute({ repo }),
    'PUT /v1/admin/settings': createUpdateSettingsRoute({ repo, eventBridge, busName, logger }),
  },
  logger,
  { passwordGate: createRemotePasswordGate(lambda, accountsFunctionName) },
);

export const handler = async (event: unknown) => {
  if (isSettingsReadRequest(event)) return readSettings(repo, event);
  return http(event as HttpEvent);
};
