// Reporting の試験で使う部品の組み立て
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';

export const region = 'ap-northeast-1';
const credentials = { accessKeyId: 'test', secretAccessKey: 'test' };

export const clients = () => ({
  ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials })),
  s3: new S3Client({ region, credentials }),
  eventBridge: new EventBridgeClient({ region, credentials }),
  lambda: new LambdaClient({ region, credentials }),
});

export const reportingTables = {
  photos: 'Photos',
  reports: 'Reports',
  submissionKeys: 'SubmissionKeys',
};

export const fixedNow =
  (iso = '2026-11-23T03:00:00.000Z') =>
  () =>
    new Date(iso);

export function sequenceIds(...ids: string[]) {
  let i = 0;
  return () => ids[i++] ?? `id-${i}`;
}
