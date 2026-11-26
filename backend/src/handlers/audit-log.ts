// AuditLog の関数の入口: API（GET /v1/admin/audit-entries）とEventBridgeの受け手（audit.recorded）を見分ける。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import type { EventBridgeEvent } from 'aws-lambda';
import { createAuditLogRepository } from '../audit-log/repository';
import { createOnRecorded } from '../audit-log/on-recorded';
import { createListEntriesRoute } from '../audit-log/list-entries';
import { requireEnv } from '../shared/env';
import { createHttpHandler, type HttpEvent } from '../shared/http';
import { createLogger } from '../shared/logger';
import { createRemotePasswordGate } from '../shared/password-gate-client';

const logger = createLogger('audit-log');
const repo = createAuditLogRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  requireEnv('AUDIT_ENTRIES_TABLE'),
);
const onRecorded = createOnRecorded({ repo, logger });
const lambda = new LambdaClient({});
const accountsFunctionName = requireEnv('ACCOUNTS_FUNCTION_NAME');
const http = createHttpHandler(
  { 'GET /v1/admin/audit-entries': createListEntriesRoute({ repo }) },
  logger,
  // U4（BR11.4。レビューで発見）: 仮のパスワードのままの管理者を拒む
  { passwordGate: createRemotePasswordGate(lambda, accountsFunctionName) },
);

function isEventBridgeEvent(event: unknown): event is EventBridgeEvent<string, unknown> {
  return typeof event === 'object' && event !== null && 'detail-type' in event && 'source' in event;
}

export const handler = async (event: unknown) => {
  if (isEventBridgeEvent(event)) return onRecorded(event as Parameters<typeof onRecorded>[0]);
  return http(event as HttpEvent);
};
