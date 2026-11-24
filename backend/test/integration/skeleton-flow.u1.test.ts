// 細い版の流れの結合の試験（US2.1・US4.3・US5.1、NFR10.2〜NFR10.5）。
// DynamoDB は DynamoDB Local（npm の dynamodb-local。Docker は使わないが Java 17 以上が要る）で本物の表を使う。
// EventBridge・S3・Cognito・Lambda の呼び出しはモックにし、送られた知らせを受け手に直接渡す。
// Java がない環境では、この試験は「飛ばした」として表示される（黙って成功にはしない）。
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import * as dynamoDbLocalModule from 'dynamodb-local';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import type {
  EventEnvelope,
  ReportSavedData,
  ReviewStatusChangedData,
} from '../../src/shared/events';
import { createHttpHandler } from '../../src/shared/http';
import { createLogger } from '../../src/shared/logger';
import { createProcessedEvents } from '../../src/shared/processed-events';
import { createReportingRepository } from '../../src/reporting/repository';
import { createPhotoRoutes } from '../../src/reporting/photos';
import { createSubmitRoutes } from '../../src/reporting/submit';
import { createSpeciesDetectionRepository } from '../../src/species-detection/repository';
import { createReviewRepository } from '../../src/review/repository';
import { createReviewOnSaved } from '../../src/review/on-saved';
import { createDecisionRoutes } from '../../src/review/decision';
import { createCatalogRepository } from '../../src/catalog/repository';
import { createCatalogOnSaved } from '../../src/catalog/on-saved';
import { createCatalogOnStatus } from '../../src/catalog/on-status';
import { createListRoutes } from '../../src/catalog/list';
import { apiEvent, busEvent, hunterClaims, requesterClaims } from '../helpers/events';
import { u2Tables } from '../helpers/tables';

// CommonJS のパッケージのため、default と名前付きのどちらで読まれても使えるようにする
const DynamoDbLocal =
  (dynamoDbLocalModule as unknown as { default?: typeof dynamoDbLocalModule }).default ??
  dynamoDbLocalModule;

const PORT = 8137;
const javaAvailable = spawnSync('java', ['-version']).status === 0;
if (!javaAvailable) {
  console.warn(
    '[skeleton-flow] Java がないため DynamoDB Local を起動できず、結合の試験を飛ばします',
  );
}

const credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
const region = 'ap-northeast-1';
const ebMock = mockClient(EventBridgeClient);
const s3Mock = mockClient(S3Client);

const tables: CreateTableCommandInput[] = [
  {
    TableName: 'Photos',
    KeySchema: [{ AttributeName: 'photoId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'photoId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'Reports',
    KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'reportId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'SubmissionKeys',
    KeySchema: [{ AttributeName: 'submissionKey', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'submissionKey', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ReviewDecisions',
    KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'reportId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ProcessedEvents',
    KeySchema: [{ AttributeName: 'consumerEventId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'consumerEventId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ReportListItems',
    KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'reportId', AttributeType: 'S' },
      { AttributeName: 'listPartition', AttributeType: 'S' },
      { AttributeName: 'hunterAccountId', AttributeType: 'S' },
      { AttributeName: 'sortKey', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'gsiAll',
        KeySchema: [
          { AttributeName: 'listPartition', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'gsiHunter',
        KeySchema: [
          { AttributeName: 'hunterAccountId', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  ...u2Tables,
];

describe.skipIf(!javaAvailable)('細い版の流れ（DynamoDB Local）', () => {
  const raw = new DynamoDBClient({ region, credentials, endpoint: `http://localhost:${PORT}` });
  const ddb = DynamoDBDocumentClient.from(raw);
  const eventBridge = new EventBridgeClient({ region, credentials });
  const s3 = new S3Client({ region, credentials });
  const rekognition = new RekognitionClient({ region, credentials });
  const silent = createLogger('it', () => undefined);
  const reportingRepo = createReportingRepository(ddb, {
    photos: 'Photos',
    reports: 'Reports',
    submissionKeys: 'SubmissionKeys',
  });
  const detectionRepo = createSpeciesDetectionRepository(ddb, 'DetectionResults');
  const reviewRepo = createReviewRepository(ddb, 'ReviewDecisions');
  const catalogRepo = createCatalogRepository(ddb, 'ReportListItems');
  // U2 の対象地域・重複の判定は別の結合の試験で確かめる。ここでは常に許す値を返す
  const permissiveSettings = async () => ({
    settingKey: 'default',
    duplicateDistanceMeters: 1000,
    duplicateWindowHours: 24,
    targetAreaNorth: 90,
    targetAreaSouth: -90,
    targetAreaEast: 180,
    targetAreaWest: -180,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const noDuplicate = async () => ({ suspected: false, matches: [] });

  const api = createHttpHandler(
    {
      ...createPhotoRoutes({
        repo: reportingRepo,
        detectionRepo,
        rekognition,
        rateLimiter: { tryConsume: async () => false }, // 結合の試験では Rekognition を呼ばない
        s3,
        bucket: 'photo-bucket',
      }),
      ...createSubmitRoutes({
        repo: reportingRepo,
        detectionRepo,
        eventBridge,
        busName: 'bus',
        eligibility: async () => ({
          eligible: true,
          hunterNumber: '123',
          displayName: 'ハンター A',
        }),
        settings: permissiveSettings,
        duplicateCheck: noDuplicate,
        logger: silent,
        publishOptions: { sleep: async () => undefined },
      }),
      ...createDecisionRoutes({
        repo: reviewRepo,
        eventBridge,
        busName: 'bus',
        logger: silent,
        publishOptions: { sleep: async () => undefined },
      }),
      ...createListRoutes({ repo: catalogRepo }),
    },
    silent,
  );
  const reviewOnSaved = createReviewOnSaved({
    repo: reviewRepo,
    processed: createProcessedEvents(ddb, 'ProcessedEvents', 'review-on-saved'),
    logger: silent,
  });
  const catalogOnSaved = createCatalogOnSaved({
    repo: catalogRepo,
    processed: createProcessedEvents(ddb, 'ProcessedEvents', 'catalog-on-saved'),
    logger: silent,
  });
  const catalogOnStatus = createCatalogOnStatus({
    repo: catalogRepo,
    processed: createProcessedEvents(ddb, 'ProcessedEvents', 'catalog-on-status'),
    logger: silent,
  });

  /** モックの EventBridge に送られた知らせを取り出す */
  function sentEvents<T>(type: string): EventEnvelope<T>[] {
    return ebMock
      .commandCalls(PutEventsCommand)
      .map((c) => c.args[0].input.Entries?.[0])
      .filter((e) => e?.DetailType === type)
      .map((e) => JSON.parse(e?.Detail ?? '{}') as EventEnvelope<T>);
  }

  async function uploadPhoto(
    hunter: string,
    kind: 'body' | 'tail' | 'chest' = 'body',
  ): Promise<string> {
    const created = await api(
      apiEvent({
        routeKey: 'POST /v1/photos',
        claims: hunterClaims(hunter),
        body: { kind, contentType: 'image/jpeg', sizeBytes: 1000 },
      }),
    );
    const { photoId } = JSON.parse(created.body ?? '{}') as { photoId: string };
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 1000, ContentType: 'image/jpeg' });
    const done = await api(
      apiEvent({
        routeKey: 'POST /v1/photos/{photoId}/complete',
        claims: hunterClaims(hunter),
        pathParameters: { photoId },
      }),
    );
    expect(done.statusCode).toBe(200);
    return photoId;
  }

  /** U2 の完全な報告の送信（全身・尻尾の写真、種類・雌雄・成獣／幼獣・捕獲の方法・捕獲日時・場所） */
  const submit = (
    hunter: string,
    photoIds: { body: string; tail: string },
    submissionKey: string,
  ) =>
    api(
      apiEvent({
        routeKey: 'POST /v1/reports',
        claims: hunterClaims(hunter),
        body: {
          submissionKey,
          photos: { body: photoIds.body, tail: photoIds.tail },
          capturedAt: '2026-11-22T12:00:00.000Z',
          capturedAtSource: 'exif',
          location: { lat: 35, lng: 135 },
          locationSource: 'exif',
          species: 'boar',
          sex: 'male',
          ageClass: 'adult',
          captureMethod: 'trap',
        },
      }),
    );

  const listOf = async (route: string, claims: Record<string, string>) => {
    const res = await api(apiEvent({ routeKey: `GET ${route}`, claims }));
    return JSON.parse(res.body ?? '{}') as {
      items: { reportId: string; status: string }[];
      totalCount: number;
    };
  };

  beforeAll(async () => {
    const installPath = fileURLToPath(
      new URL('../../../node_modules/.cache/dynamodb-local', import.meta.url),
    );
    // dynamodb-local は途中のフォルダを作らないため、先に作っておく（新しい作業コピーや CI で ENOENT になる）
    mkdirSync(installPath, { recursive: true });
    DynamoDbLocal.configureInstaller({ installPath });
    await DynamoDbLocal.launch(PORT, null, [], false, true);
    // 起動を待つ
    for (let i = 0; i < 50; i++) {
      try {
        await raw.send(new CreateTableCommand(tables[0]!));
        break;
      } catch (err) {
        if ((err as Error).name === 'ResourceInUseException') break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  });

  afterAll(async () => {
    DynamoDbLocal.stop(PORT);
  });

  beforeEach(async () => {
    ebMock.reset();
    s3Mock.reset();
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    for (const t of tables) {
      await raw.send(new DeleteTableCommand({ TableName: t.TableName })).catch(() => undefined);
      await raw.send(new CreateTableCommand(t));
    }
  });

  it('写真の受け付け → 送信 → report.saved → 一覧に「確認中」→ 承認 → 一覧が「承認」', async () => {
    const body = await uploadPhoto('hunter-a', 'body');
    const tail = await uploadPhoto('hunter-a', 'tail');
    const res = await submit('hunter-a', { body, tail }, 'sub-key-it-0001');
    expect(res.statusCode).toBe(201);
    const { reportId } = JSON.parse(res.body ?? '{}') as { reportId: string };

    const [saved] = sentEvents<ReportSavedData>('report.saved');
    await reviewOnSaved(busEvent('report.saved', saved!));
    await catalogOnSaved(busEvent('report.saved', saved!));

    const mine = await listOf('/v1/catalog/my-reports', hunterClaims('hunter-a'));
    expect(mine.items).toEqual([expect.objectContaining({ reportId, status: 'checking' })]);

    const decided = await api(
      apiEvent({
        routeKey: 'PUT /v1/reviews/{reportId}/decision',
        claims: requesterClaims(),
        pathParameters: { reportId },
        body: { decision: 'approved' },
      }),
    );
    expect(decided.statusCode).toBe(200);
    const [changed] = sentEvents<ReviewStatusChangedData>('review.status-changed');
    await catalogOnStatus(busEvent('review.status-changed', changed!));

    const all = await listOf('/v1/catalog/reports', requesterClaims());
    expect(all.items).toEqual([expect.objectContaining({ reportId, status: 'approved' })]);
    expect(
      (await listOf('/v1/catalog/my-reports', hunterClaims('hunter-a'))).items[0]?.status,
    ).toBe('approved');
  });

  it('同じ送信のキーの二重送信は 1 件だけ作り、同じ reportId を返す', async () => {
    const body = await uploadPhoto('hunter-a', 'body');
    const tail = await uploadPhoto('hunter-a', 'tail');
    const first = await submit('hunter-a', { body, tail }, 'sub-key-it-0002');
    const second = await submit('hunter-a', { body, tail }, 'sub-key-it-0002');
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body ?? '{}')).toEqual(JSON.parse(first.body ?? '{}'));
    expect(sentEvents('report.saved')).toHaveLength(1);
  });

  it('2 人の依頼元が同時に承認しても、先の 1 人だけが有効（もう 1 人は 409）', async () => {
    const body = await uploadPhoto('hunter-a', 'body');
    const tail = await uploadPhoto('hunter-a', 'tail');
    const { reportId } = JSON.parse(
      (await submit('hunter-a', { body, tail }, 'sub-key-it-0003')).body ?? '{}',
    );
    await reviewOnSaved(busEvent('report.saved', sentEvents<ReportSavedData>('report.saved')[0]!));
    const decide = (sub: string) =>
      api(
        apiEvent({
          routeKey: 'PUT /v1/reviews/{reportId}/decision',
          claims: requesterClaims(sub),
          pathParameters: { reportId },
          body: { decision: 'approved' },
        }),
      );
    const results = await Promise.all([decide('requester-a'), decide('requester-b')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });

  it('状態の知らせが保存の知らせより先に届いても、保存のあとで「承認」として一覧に出る。ハンターは他人の報告を見ない', async () => {
    const body = await uploadPhoto('hunter-a', 'body');
    const tail = await uploadPhoto('hunter-a', 'tail');
    const { reportId } = JSON.parse(
      (await submit('hunter-a', { body, tail }, 'sub-key-it-0004')).body ?? '{}',
    );
    const saved = sentEvents<ReportSavedData>('report.saved')[0]!;
    await catalogOnStatus(
      busEvent('review.status-changed', {
        eventId: 'status-first',
        type: 'review.status-changed',
        version: 1,
        occurredAt: new Date(Date.now() + 60_000).toISOString(),
        source: 'Review',
        data: { reportId, status: 'approved', previousStatus: 'checking', changedAt: '' },
      }),
    );
    expect((await listOf('/v1/catalog/reports', requesterClaims())).totalCount).toBe(0);
    await catalogOnSaved(busEvent('report.saved', saved));
    const all = await listOf('/v1/catalog/reports', requesterClaims());
    expect(all.items).toEqual([expect.objectContaining({ reportId, status: 'approved' })]);
    expect((await listOf('/v1/catalog/my-reports', hunterClaims('hunter-b'))).items).toEqual([]);
  });
});
