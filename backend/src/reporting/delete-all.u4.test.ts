// POST /v1/admin/detection-data・/reporting-data の試験（BR13.1の順番④⑤）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createDeleteDetectionDataRoute, createDeleteReportingDataRoute } from './delete-all';
import { createLogger } from '../shared/logger';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const ebMock = mockClient(EventBridgeClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const s3 = new S3Client({ region: 'ap-northeast-1' });
const eventBridge = new EventBridgeClient({ region: 'ap-northeast-1' });
const logger = createLogger('reporting', () => undefined);
const now = () => new Date('2026-11-25T00:00:00.000Z');

const deps = {
  ddb,
  s3,
  bucket: 'photos-bucket',
  detectionResultsTable: 'DetectionResults',
  reportsTable: 'Reports',
  photosTable: 'Photos',
  eventBridge,
  busName: 'bus',
  logger,
  now,
};

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  ebMock.reset();
});

describe('createDeleteDetectionDataRoute', () => {
  it('DetectionResultsを全件消す（順番④）', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ photoId: 'p1' }] });
    ddbMock.on(BatchWriteCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createDeleteDetectionDataRoute(deps);
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/detection-data',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toEqual({ deletedCount: 1 });
  });

  it('管理者でなければ403', async () => {
    const route = createDeleteDetectionDataRoute(deps);
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/detection-data',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});

describe('createDeleteReportingDataRoute', () => {
  it('写真をS3から先に消し、Photo・Reportの表を消す（順番⑤）', async () => {
    ddbMock
      .on(ScanCommand, { TableName: 'Photos' })
      .resolves({ Items: [{ photoId: 'p1', storageKey: 'photos/hunter-a/p1' }] });
    ddbMock.on(ScanCommand, { TableName: 'Reports' }).resolves({ Items: [{ reportId: 'r1' }] });
    ddbMock.on(BatchWriteCommand).resolves({});
    s3Mock.on(DeleteObjectsCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createDeleteReportingDataRoute(deps);
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/reporting-data',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toEqual({ deletedCount: 1 });
    const s3Call = s3Mock.commandCalls(DeleteObjectsCommand)[0]?.args[0].input;
    expect(s3Call?.Delete?.Objects).toEqual([{ Key: 'photos/hunter-a/p1' }]);
  });

  it('写真が0件でもS3は呼ばない', async () => {
    ddbMock.on(ScanCommand, { TableName: 'Photos' }).resolves({ Items: [] });
    ddbMock.on(ScanCommand, { TableName: 'Reports' }).resolves({ Items: [] });
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createDeleteReportingDataRoute(deps);
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/reporting-data',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toEqual({ deletedCount: 0 });
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  it('管理者でなければ403', async () => {
    const route = createDeleteReportingDataRoute(deps);
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/reporting-data',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
