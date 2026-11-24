// Settings の関数の入口。API Gateway の道は持たず、Lambda の直接の呼び出しだけで受ける
// （infrastructure-specification.md §2）。Reporting・DuplicateDetection だけが呼べる（IAM）。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createSettingsRepository } from '../settings/repository';
import { isSettingsReadRequest, readSettings } from '../settings/internal';
import { requireEnv } from '../shared/env';

const repo = createSettingsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  requireEnv('SETTINGS_TABLE'),
);

export const handler = async (event: unknown) => {
  if (!isSettingsReadRequest(event)) {
    throw new Error('settings 関数は内部の呼び出し専用です（API Gateway の道を持たない）');
  }
  return readSettings(repo, event);
};
