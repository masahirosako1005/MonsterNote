// Reporting の関数の入口（C2 の写真・報告・設定の読み出しの道）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { S3Client } from '@aws-sdk/client-s3';
import { createReportingRepository } from '../reporting/repository';
import { createPhotoRoutes } from '../reporting/photos';
import { createSubmitRoutes, createEligibilityClient } from '../reporting/submit';
import { createGetReportRoutes } from '../reporting/get-report';
import { createReportSettingsRoutes } from '../reporting/report-settings';
import { createSettingsClient, createDuplicateCheckClient } from '../reporting/internal-clients';
import { createSpeciesDetectionRepository } from '../species-detection/repository';
import { createDetectionRateLimiter } from '../species-detection/rate-limit';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';

const logger = createLogger('reporting');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repo = createReportingRepository(ddb, {
  photos: requireEnv('PHOTOS_TABLE'),
  reports: requireEnv('REPORTS_TABLE'),
  submissionKeys: requireEnv('SUBMISSION_KEYS_TABLE'),
});
const detectionRepo = createSpeciesDetectionRepository(ddb, requireEnv('DETECTION_RESULTS_TABLE'));
const rateLimiter = createDetectionRateLimiter(ddb, requireEnv('DETECTION_RATE_LIMITS_TABLE'));
const s3 = new S3Client({});
const bucket = requireEnv('PHOTO_BUCKET');
const lambda = new LambdaClient({});
const settingsClient = createSettingsClient(lambda, requireEnv('SETTINGS_FUNCTION_NAME'));
const duplicateCheckClient = createDuplicateCheckClient(
  lambda,
  requireEnv('DUPLICATE_DETECTION_FUNCTION_NAME'),
);

export const handler = createHttpHandler(
  {
    ...createPhotoRoutes({
      repo,
      detectionRepo,
      rekognition: new RekognitionClient({}),
      rateLimiter,
      s3,
      bucket,
    }),
    ...createSubmitRoutes({
      repo,
      detectionRepo,
      eventBridge: new EventBridgeClient({}),
      busName: requireEnv('EVENT_BUS_NAME'),
      eligibility: createEligibilityClient(lambda, requireEnv('ACCOUNTS_FUNCTION_NAME')),
      settings: settingsClient,
      duplicateCheck: duplicateCheckClient,
      logger,
    }),
    ...createGetReportRoutes({ repo, s3, bucket }),
    ...createReportSettingsRoutes({ settings: settingsClient }),
  },
  logger,
);
