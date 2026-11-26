// Reporting の関数の入口（C2 の写真・報告・設定の読み出しの道、U4ですべて削除の入口を足す）
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
import {
  createDeleteDetectionDataRoute,
  createDeleteReportingDataRoute,
} from '../reporting/delete-all';
import { createSettingsClient, createDuplicateCheckClient } from '../reporting/internal-clients';
import { createSpeciesDetectionRepository } from '../species-detection/repository';
import { createDetectionRateLimiter } from '../species-detection/rate-limit';
import { requireEnv } from '../shared/env';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { createRemotePasswordGate } from '../shared/password-gate-client';

const logger = createLogger('reporting');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const photosTable = requireEnv('PHOTOS_TABLE');
const reportsTable = requireEnv('REPORTS_TABLE');
const repo = createReportingRepository(ddb, {
  photos: photosTable,
  reports: reportsTable,
  submissionKeys: requireEnv('SUBMISSION_KEYS_TABLE'),
});
const detectionResultsTable = requireEnv('DETECTION_RESULTS_TABLE');
const detectionRepo = createSpeciesDetectionRepository(ddb, detectionResultsTable);
const rateLimiter = createDetectionRateLimiter(ddb, requireEnv('DETECTION_RATE_LIMITS_TABLE'));
const s3 = new S3Client({});
const bucket = requireEnv('PHOTO_BUCKET');
const lambda = new LambdaClient({});
const accountsFunctionName = requireEnv('ACCOUNTS_FUNCTION_NAME');
const settingsClient = createSettingsClient(lambda, requireEnv('SETTINGS_FUNCTION_NAME'));
const duplicateCheckClient = createDuplicateCheckClient(
  lambda,
  requireEnv('DUPLICATE_DETECTION_FUNCTION_NAME'),
);
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');

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
      eventBridge,
      busName,
      eligibility: createEligibilityClient(lambda, accountsFunctionName),
      settings: settingsClient,
      duplicateCheck: duplicateCheckClient,
      logger,
    }),
    ...createGetReportRoutes({ repo, s3, bucket }),
    ...createReportSettingsRoutes({ settings: settingsClient }),
    'POST /v1/admin/detection-data': createDeleteDetectionDataRoute({
      ddb,
      s3,
      bucket,
      detectionResultsTable,
      reportsTable,
      photosTable,
      eventBridge,
      busName,
      logger,
    }),
    'POST /v1/admin/reporting-data': createDeleteReportingDataRoute({
      ddb,
      s3,
      bucket,
      detectionResultsTable,
      reportsTable,
      photosTable,
      eventBridge,
      busName,
      logger,
    }),
  },
  logger,
  { passwordGate: createRemotePasswordGate(lambda, accountsFunctionName) },
);
