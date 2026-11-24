// 報告の詳細の試験（BR2.8・BR6.1、AC4.2.1・AC4.2.3・AC5.1.3）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createGetReportRoutes } from './get-report';
import { createReportingRepository } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients, reportingTables } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const handler = createHttpHandler(
  createGetReportRoutes({
    repo: createReportingRepository(c.ddb, reportingTables),
    s3: c.s3,
    bucket: 'photo-bucket',
  }),
  createLogger('reporting', () => undefined),
);

const report = {
  reportId: 'report-1',
  submissionKey: 'sub-key-0001',
  hunterAccountId: 'hunter-a',
  hunterNumber: '123',
  capturedAt: '2026-11-23T03:00:00.000Z',
  capturedAtSource: 'exif',
  location: { lat: 35, lng: 135 },
  locationSource: 'exif',
  manualEntry: false,
  species: 'boar',
  autoDetectionOutcome: 'undetected',
  sex: 'male',
  ageClass: 'adult',
  captureMethod: 'trap',
  confirmedNotDuplicate: false,
  submittedAt: '2026-11-23T03:00:00.000Z',
  bodyPhotoId: 'photo-1',
  tailPhotoId: 'photo-2',
  eventSent: true,
};
const photo = {
  photoId: 'photo-1',
  uploadedByAccountId: 'hunter-a',
  reportId: 'report-1',
  kind: 'body',
  storageKey: 'photos/hunter-a/photo-1',
  contentType: 'image/jpeg',
  sizeBytes: 1000,
  uploadStatus: 'uploaded',
  uploadedAt: '2026-11-23T03:00:00.000Z',
};
const tailPhoto = {
  ...photo,
  photoId: 'photo-2',
  kind: 'tail',
  storageKey: 'photos/hunter-a/photo-2',
};

const get = (claims: Record<string, string>, reportId = 'report-1') =>
  handler(
    apiEvent({ routeKey: 'GET /v1/reports/{reportId}', claims, pathParameters: { reportId } }),
  );
const bodyOf = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand, { TableName: 'Reports' }).resolves({ Item: report });
  ddbMock.on(GetCommand, { TableName: 'Photos', Key: { photoId: 'photo-1' } }).resolves({
    Item: photo,
  });
  ddbMock.on(GetCommand, { TableName: 'Photos', Key: { photoId: 'photo-2' } }).resolves({
    Item: tailPhoto,
  });
});

describe('GET /v1/reports/{reportId}', () => {
  it('依頼元はすべての報告の詳細（成獣／幼獣・捕獲の方法を含む）と、写真（全身・尻尾）の表示用 URL（15 分）を読める（U2）', async () => {
    const res = await get(requesterClaims());
    expect(res.statusCode).toBe(200);
    const b = bodyOf(res);
    expect(b).toMatchObject({
      reportId: 'report-1',
      hunterAccountId: 'hunter-a',
      hunterNumber: '123',
      species: 'boar',
      sex: 'male',
      ageClass: 'adult',
      captureMethod: 'trap',
      capturedAt: '2026-11-23T03:00:00.000Z',
      location: { lat: 35, lng: 135 },
    });
    const photos = b.photos as { kind: string; url: string; expiresInSeconds: number }[];
    expect(photos.map((p) => p.kind).sort()).toEqual(['body', 'tail']);
    expect(photos[0]?.expiresInSeconds).toBe(900);
    expect(photos.some((p) => p.url.includes('X-Amz-Expires=900'))).toBe(true);
  });

  it('ハンターは自分の報告を読める', async () => {
    expect((await get(hunterClaims('hunter-a'))).statusCode).toBe(200);
  });

  it('ハンターは他人の報告を読めない（403）', async () => {
    const res = await get(hunterClaims('hunter-b'));
    expect(res.statusCode).toBe(403);
    expect(ddbMock.commandCalls(GetCommand, { TableName: 'Photos' })).toHaveLength(0);
  });

  it('報告がなければ 404', async () => {
    ddbMock.on(GetCommand, { TableName: 'Reports' }).resolves({ Item: undefined });
    expect((await get(requesterClaims(), 'none')).statusCode).toBe(404);
  });

  it('役割のない利用者（admin だけ）は 403', async () => {
    expect((await get({ sub: 'admin-1', 'cognito:groups': '[admin]' })).statusCode).toBe(403);
  });

  it('写真の記録がなくても詳細は返し、写真は空にする', async () => {
    ddbMock.on(GetCommand, { TableName: 'Photos' }).resolves({ Item: undefined });
    const res = await get(requesterClaims());
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).photos).toEqual([]);
  });
});
