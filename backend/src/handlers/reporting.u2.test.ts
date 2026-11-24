// reporting 関数の入口の U2 の拡張の試験（GET /v1/report-settings・判別結果を含む complete の応答・
// 重複の疑いを含む POST /v1/reports の応答。内部のクライアントは Lambda の直接の呼び出し越しに検証する）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { apiEvent, hunterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);
const rekognitionMock = mockClient(RekognitionClient);

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  PHOTOS_TABLE: 'Photos',
  REPORTS_TABLE: 'Reports',
  SUBMISSION_KEYS_TABLE: 'SubmissionKeys',
  DETECTION_RESULTS_TABLE: 'DetectionResults',
  DETECTION_RATE_LIMITS_TABLE: 'DetectionRateLimits',
  PHOTO_BUCKET: 'photo-bucket',
  EVENT_BUS_NAME: 'monsternote-dev',
  ACCOUNTS_FUNCTION_NAME: 'accounts-fn',
  SETTINGS_FUNCTION_NAME: 'settings-fn',
  DUPLICATE_DETECTION_FUNCTION_NAME: 'duplicate-detection-fn',
};

const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

const settingsRecord = {
  settingKey: 'default',
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

beforeEach(() => {
  ddbMock.reset();
  lambdaMock.reset();
  rekognitionMock.reset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('reporting の関数の入口（U2）', () => {
  it('GET /v1/report-settings: 利用者の証明を Settings 関数へ転送し、対象地域を返す（ADR-010）', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload(settingsRecord) });
    const { handler } = await import('./reporting');
    const res = await handler(
      apiEvent({ routeKey: 'GET /v1/report-settings', claims: hunterClaims() }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}') as { targetArea: Record<string, number> };
    expect(body.targetArea).toEqual({ north: 46, south: 20, east: 154, west: 122 });
    const invoked = lambdaMock.commandCalls(InvokeCommand)[0]?.args[0].input;
    expect(invoked?.FunctionName).toBe('settings-fn');
    const sentPayload = JSON.parse(new TextDecoder().decode(invoked?.Payload as Uint8Array));
    expect(sentPayload).toMatchObject({
      kind: 'settings-read',
      auth: { authKind: 'caller', caller: { sub: 'hunter-a' } },
    });
  });

  it('GET /v1/report-settings: 依頼元は 403', async () => {
    const { handler } = await import('./reporting');
    const res = await handler(
      apiEvent({
        routeKey: 'GET /v1/report-settings',
        claims: { sub: 'r1', 'cognito:groups': '[requester]' },
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('POST /v1/photos/{photoId}/complete: 全身の写真は判別の結果を応答に含める', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        photoId: 'photo-1',
        uploadedByAccountId: 'hunter-a',
        kind: 'body',
        storageKey: 'photos/hunter-a/photo-1',
        contentType: 'image/jpeg',
        sizeBytes: 1000,
        uploadStatus: 'pending',
        uploadedAt: '2026-11-23T00:00:00.000Z',
      },
    });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});
    const { HeadObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
    const s3Mock = mockClient(S3Client);
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 1000, ContentType: 'image/jpeg' });
    const { handler } = await import('./reporting');
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/photos/{photoId}/complete',
        claims: hunterClaims(),
        pathParameters: { photoId: 'photo-1' },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}') as { detection?: { outcome: string } };
    expect(body.detection?.outcome).toBe('undetected'); // レート制限の初回呼び出しは実際の DynamoDB に当たるため既定で拒まれる設定の下では undetected
  });
});
