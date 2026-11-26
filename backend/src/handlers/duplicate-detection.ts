// DuplicateDetection の関数の入口: API の道（C5 GET /v1/duplicates/{reportId}、U4ですべて削除を足す）と、
// Reporting からの内部の直接の呼び出し（C9 POST /internal/v1/duplicate-checks）を見分ける。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { createDuplicateRepository } from '../duplicate-detection/repository';
import { createDuplicateListRoutes } from '../duplicate-detection/list';
import { createDeleteAllRoute } from '../duplicate-detection/delete-all';
import {
  checkDuplicate,
  isDuplicateCheckRequest,
  requireHunterCaller,
} from '../duplicate-detection/pre-submit';
import { createReviewRepository } from '../review/repository';
import type { SettingRecord } from '../settings/repository';
import type { Role } from '../shared/auth';
import { requireEnv } from '../shared/env';
import { createHttpHandler, type HttpEvent } from '../shared/http';
import { componentIdentity, invokeInternal } from '../shared/internal-invoke';
import { createLogger } from '../shared/logger';
import { createRemotePasswordGate } from '../shared/password-gate-client';

const logger = createLogger('duplicate-detection');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const footprintsTable = requireEnv('REPORT_FOOTPRINTS_TABLE');
const suspicionsTable = requireEnv('DUPLICATE_SUSPICIONS_TABLE');
const repo = createDuplicateRepository(ddb, {
  footprints: footprintsTable,
  suspicions: suspicionsTable,
});
const reviewRepo = createReviewRepository(ddb, requireEnv('REVIEW_DECISIONS_TABLE'));
const lambda = new LambdaClient({});
const settingsFunctionName = requireEnv('SETTINGS_FUNCTION_NAME');
const accountsFunctionName = requireEnv('ACCOUNTS_FUNCTION_NAME');
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');

/** ADR-011 ②: 部品の身元の証明で Settings を読む（送信前・保存後のどちらの判定でも同じ） */
export async function readSettingsAsComponent(): Promise<SettingRecord> {
  return invokeInternal(lambda, settingsFunctionName, {
    kind: 'settings-read',
    auth: componentIdentity('DuplicateDetection'),
  });
}

const http = createHttpHandler(
  {
    ...createDuplicateListRoutes({
      repo,
      getMatchedStatus: async (reportId) => (await reviewRepo.get(reportId))?.status ?? 'checking',
    }),
    'POST /v1/admin/duplicate-data': createDeleteAllRoute({
      ddb,
      footprintsTable,
      suspicionsTable,
      eventBridge,
      busName,
      logger,
    }),
  },
  logger,
  { passwordGate: createRemotePasswordGate(lambda, accountsFunctionName) },
);

export const handler = async (event: unknown) => {
  if (isDuplicateCheckRequest(event)) {
    if (event.auth.authKind !== 'caller') {
      throw new Error('duplicate-check は呼び出し元の利用者の証明を要ります');
    }
    requireHunterCaller({
      accountId: event.auth.caller.sub,
      roles: event.auth.caller.roles as Role[],
    });
    const settings = await readSettingsAsComponent();
    return checkDuplicate(repo, settings, {
      species: event.species,
      capturedAt: event.capturedAt,
      location: event.location,
    });
  }
  return http(event as HttpEvent);
};
