// 写真の受け付けとアップロードの完了の試験（BR2.2・BR2.9、AC2.1.1、NFR5.3）。
// U2: 端末で縮小した JPEG だけを受け付け（D-4）、全身の写真は完了のたびに種類を判別する（BR6.2・BR6.3・NFR12.5）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand, HeadObjectCommand, NotFound, S3Client } from '@aws-sdk/client-s3';
import { DetectLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { createPhotoRoutes } from './photos';
import { createReportingRepository } from './repository';
import { createSpeciesDetectionRepository } from '../species-detection/repository';
import type { DetectionRateLimiter } from '../species-detection/rate-limit';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients, fixedNow, reportingTables, sequenceIds } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const rekognitionMock = mockClient(RekognitionClient);
const c = clients();
const rekognition = new RekognitionClient({ region: 'ap-northeast-1' });

function fakeRateLimiter(allowed = true): DetectionRateLimiter {
  return { tryConsume: vi.fn(async () => allowed) };
}

function makeHandler(rateLimiter: DetectionRateLimiter = fakeRateLimiter()) {
  return createHttpHandler(
    createPhotoRoutes({
      repo: createReportingRepository(c.ddb, reportingTables),
      detectionRepo: createSpeciesDetectionRepository(c.ddb, 'DetectionResults'),
      rekognition,
      rateLimiter,
      s3: c.s3,
      bucket: 'photo-bucket',
      now: fixedNow(),
      newId: sequenceIds('photo-1', 'detection-1'),
    }),
    createLogger('reporting', () => undefined),
  );
}

const handler = makeHandler();

const body = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;
const MB = 1024 * 1024;

const pendingPhoto = {
  photoId: 'photo-1',
  uploadedByAccountId: 'hunter-a',
  kind: 'body',
  storageKey: 'photos/hunter-a/photo-1',
  contentType: 'image/jpeg',
  sizeBytes: 2 * MB,
  uploadStatus: 'pending',
  uploadedAt: '2026-11-23T03:00:00.000Z',
  expiresAt: 1234567890,
};

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  rekognitionMock.reset();
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
});

describe('POST /v1/photos', () => {
  it('写真の ID と、署名付きの POST の URL と項目（5 分）を返し、写真を「待ち」で記録する（TTL 付き）', async () => {
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/photos',
        claims: hunterClaims(),
        body: { kind: 'body', contentType: 'image/jpeg', sizeBytes: 2 * MB },
      }),
    );
    expect(res.statusCode).toBe(201);
    const b = body(res);
    expect(b).toMatchObject({ photoId: 'photo-1', expiresInSeconds: 300 });
    expect(String(b.uploadUrl)).toContain('photo-bucket');
    const fields = b.uploadFields as Record<string, string>;
    expect(fields.key).toBe('photos/hunter-a/photo-1');
    expect(fields['Content-Type']).toBe('image/jpeg');
    // ポリシーの条件: 内容の種類・大きさ 1〜15 MB・キー
    const policy = JSON.parse(Buffer.from(fields.Policy ?? '', 'base64').toString('utf8')) as {
      conditions: unknown[];
      expiration: string;
    };
    expect(policy.conditions).toContainEqual(['content-length-range', 1, 15 * MB]);
    expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'image/jpeg']);
    // 署名の期限は今から 5 分（署名のライブラリは実際の時計を使う）
    const secondsLeft = (Date.parse(policy.expiration) - Date.now()) / 1000;
    expect(secondsLeft).toBeGreaterThan(290);
    expect(secondsLeft).toBeLessThanOrEqual(301);
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({
      photoId: 'photo-1',
      uploadedByAccountId: 'hunter-a',
      uploadStatus: 'pending',
      storageKey: 'photos/hunter-a/photo-1',
    });
    // BR2.13: uploadedAt + 24 時間の TTL
    expect(item.expiresAt).toBe(
      Math.floor(new Date('2026-11-23T03:00:00.000Z').getTime() / 1000) + 86400,
    );
  });

  it('撮影情報（exifCapturedAt・exifLocation）があれば記録する（BR2.10）', async () => {
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/photos',
        claims: hunterClaims(),
        body: {
          kind: 'body',
          contentType: 'image/jpeg',
          sizeBytes: MB,
          exifCapturedAt: '2026-11-20T01:00:00.000Z',
          exifLocation: { lat: 35.5, lng: 135.5 },
        },
      }),
    );
    expect(res.statusCode).toBe(201);
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item.exifCapturedAt).toBe('2026-11-20T01:00:00.000Z');
    expect(item.exifLocation).toEqual({ lat: 35.5, lng: 135.5 });
  });

  it('JPEG 以外（PNG・HEIC を含む）は 422 VALIDATION_FAILED（U2・D-4: 端末で JPEG に縮小してから送る）', async () => {
    for (const contentType of ['image/gif', 'image/png', 'image/heic']) {
      const res = await handler(
        apiEvent({
          routeKey: 'POST /v1/photos',
          claims: hunterClaims(),
          body: { kind: 'body', contentType, sizeBytes: MB },
        }),
      );
      expect(res.statusCode).toBe(422);
      expect(body(res)).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'contentType', reason: 'unsupported' }],
      });
    }
  });

  it('15 MB を超える・0 バイトは 422', async () => {
    for (const sizeBytes of [15 * MB + 1, 0]) {
      const res = await handler(
        apiEvent({
          routeKey: 'POST /v1/photos',
          claims: hunterClaims(),
          body: { kind: 'body', contentType: 'image/jpeg', sizeBytes },
        }),
      );
      expect(res.statusCode).toBe(422);
    }
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('写真の種類（kind）が違えば 422、依頼元は 403', async () => {
    const badKind = await handler(
      apiEvent({
        routeKey: 'POST /v1/photos',
        claims: hunterClaims(),
        body: { kind: 'face', contentType: 'image/jpeg', sizeBytes: MB },
      }),
    );
    expect(badKind.statusCode).toBe(422);
    const requester = await handler(
      apiEvent({
        routeKey: 'POST /v1/photos',
        claims: requesterClaims(),
        body: { kind: 'body', contentType: 'image/jpeg', sizeBytes: MB },
      }),
    );
    expect(requester.statusCode).toBe(403);
  });

  it('尻尾・胸の写真も受け付ける（kind=tail・chest）', async () => {
    for (const kind of ['tail', 'chest']) {
      const res = await handler(
        apiEvent({
          routeKey: 'POST /v1/photos',
          claims: hunterClaims(),
          body: { kind, contentType: 'image/jpeg', sizeBytes: MB },
        }),
      );
      expect(res.statusCode).toBe(201);
    }
  });
});

describe('POST /v1/photos/{photoId}/complete', () => {
  const complete = (claims = hunterClaims(), h = handler) =>
    h(
      apiEvent({
        routeKey: 'POST /v1/photos/{photoId}/complete',
        claims,
        pathParameters: { photoId: 'photo-1' },
      }),
    );

  it('S3 に申告どおりの写真があれば「アップロード済み」にし、全身の写真なら種類を判別する（BR6.2）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingPhoto });
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 2 * MB, ContentType: 'image/jpeg' });
    rekognitionMock
      .on(DetectLabelsCommand)
      .resolves({ Labels: [{ Name: 'Boar', Confidence: 92 }] });
    const res = await complete();
    expect(res.statusCode).toBe(200);
    expect(body(res)).toEqual({
      photoId: 'photo-1',
      uploadStatus: 'uploaded',
      detection: { outcome: 'detected', species: 'boar', confidence: 92 },
    });
    expect(
      ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeValues,
    ).toMatchObject({ ':uploaded': 'uploaded' });
    const detectionItem = ddbMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input.Item)
      .find(
        (item) =>
          (item as Record<string, unknown>)?.photoId === 'photo-1' && 'outcome' in (item as object),
      );
    expect(detectionItem).toMatchObject({ outcome: 'detected', species: 'boar', confidence: 92 });
  });

  it('尻尾・胸の写真（kind≠body）は判別しない', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...pendingPhoto, kind: 'tail' } });
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 2 * MB, ContentType: 'image/jpeg' });
    const res = await complete();
    expect(body(res)).toEqual({ photoId: 'photo-1', uploadStatus: 'uploaded' });
    expect(rekognitionMock.commandCalls(DetectLabelsCommand)).toHaveLength(0);
  });

  it('判別のサービスが失敗・時間切れでも「判別できなかった」とし、報告の作成は止めない（BR6.3）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingPhoto });
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 2 * MB, ContentType: 'image/jpeg' });
    rekognitionMock.on(DetectLabelsCommand).rejects(new Error('boom'));
    const res = await complete();
    expect(res.statusCode).toBe(200);
    expect(body(res).detection).toMatchObject({ outcome: 'undetected' });
  });

  it('1 日の判別の上限に達したら Rekognition を呼ばず「判別できなかった」とする（NFR12.5）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingPhoto });
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 2 * MB, ContentType: 'image/jpeg' });
    const res = await complete(hunterClaims(), makeHandler(fakeRateLimiter(false)));
    expect(res.statusCode).toBe(200);
    expect(body(res).detection).toMatchObject({ outcome: 'undetected' });
    expect(rekognitionMock.commandCalls(DetectLabelsCommand)).toHaveLength(0);
  });

  it('写真の記録がなければ 404', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    expect((await complete()).statusCode).toBe(404);
  });

  it('持ち主でなければ 403', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingPhoto });
    expect((await complete(hunterClaims('hunter-b'))).statusCode).toBe(403);
  });

  it('S3 に写真がなければ 404 NOT_FOUND', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingPhoto });
    s3Mock.on(HeadObjectCommand).rejects(new NotFound({ message: 'x', $metadata: {} }));
    const res = await complete();
    expect(res.statusCode).toBe(404);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('大きさか形式が申告と違えば、写真を消して 422', async () => {
    ddbMock.on(GetCommand).resolves({ Item: pendingPhoto });
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 3 * MB, ContentType: 'image/jpeg' });
    s3Mock.on(DeleteObjectCommand).resolves({});
    const res = await complete();
    expect(res.statusCode).toBe(422);
    expect(s3Mock.commandCalls(DeleteObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: 'photo-bucket',
      Key: 'photos/hunter-a/photo-1',
    });

    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 2 * MB, ContentType: 'image/png' });
    expect((await complete()).statusCode).toBe(422);
  });

  it('すでにアップロード済みなら、もう一度確かめずに 200', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...pendingPhoto, uploadStatus: 'uploaded' } });
    const res = await complete();
    expect(res.statusCode).toBe(200);
    expect(s3Mock.commandCalls(HeadObjectCommand)).toHaveLength(0);
  });
});
