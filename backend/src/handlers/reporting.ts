// Reporting の関数の入口（C2 の写真・報告の道）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { createReportingRepository } from '../reporting/repository';
import { createPhotoRoutes } from '../reporting/photos';
import { createSubmitRoutes, createEligibilityClient } from '../reporting/submit';
import { createGetReportRoutes } from '../reporting/get-report';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';

const logger = createLogger('reporting');
const repo = createReportingRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
  photos: requireEnv('PHOTOS_TABLE'),
  reports: requireEnv('REPORTS_TABLE'),
  submissionKeys: requireEnv('SUBMISSION_KEYS_TABLE'),
});
const s3 = new S3Client({});
const bucket = requireEnv('PHOTO_BUCKET');

export const handler = createHttpHandler(
  {
    ...createPhotoRoutes({ repo, s3, bucket }),
    ...createSubmitRoutes({
      repo,
      eventBridge: new EventBridgeClient({}),
      busName: requireEnv('EVENT_BUS_NAME'),
      eligibility: createEligibilityClient(
        new LambdaClient({}),
        requireEnv('ACCOUNTS_FUNCTION_NAME'),
      ),
      logger,
    }),
    ...createGetReportRoutes({ repo, s3, bucket }),
  },
  logger,
);
