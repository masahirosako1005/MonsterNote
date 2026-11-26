// U3 の結合の試験（DynamoDB Local。本物の表で、予約語などモックでは見つからない誤りを確かめる）。
// 却下 → 取り消し → もう一度の確認、重複の疑いの知らせ、絞り込み一覧の流れ（UC15〜UC19）。
// skeleton-flow.u1.test.ts と同じ方針だが、別のポートで DynamoDB Local を起動し干渉しない。
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
import type { EventEnvelope, ReviewStatusChangedData } from '../../src/shared/events';
import { createHttpHandler } from '../../src/shared/http';
import { createLogger } from '../../src/shared/logger';
import { createProcessedEvents } from '../../src/shared/processed-events';
import { createReviewRepository } from '../../src/review/repository';
import { createDecisionRoutes } from '../../src/review/decision';
import { createGetReviewRoutes } from '../../src/review/get-review';
import { createUndoRoutes } from '../../src/review/undo';
import { createCatalogRepository } from '../../src/catalog/repository';
import { createCatalogOnDuplicate } from '../../src/catalog/on-duplicate';
import { createListRoutes } from '../../src/catalog/list';
import { apiEvent, busEvent, requesterClaims } from '../helpers/events';

const DynamoDbLocal =
  (dynamoDbLocalModule as unknown as { default?: typeof dynamoDbLocalModule }).default ??
  dynamoDbLocalModule;

const PORT = 8138;
const javaAvailable = spawnSync('java', ['-version']).status === 0;
if (!javaAvailable) {
  console.warn(
    '[u3-review-flow] Java がないため DynamoDB Local を起動できず、結合の試験を飛ばします',
  );
}

const credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
const region = 'ap-northeast-1';
const ebMock = mockClient(EventBridgeClient);

const tables: CreateTableCommandInput[] = [
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
];

describe.skipIf(!javaAvailable)('U3 の結合の流れ（DynamoDB Local）', () => {
  const raw = new DynamoDBClient({ region, credentials, endpoint: `http://localhost:${PORT}` });
  const ddb = DynamoDBDocumentClient.from(raw);
  const eventBridge = new EventBridgeClient({ region, credentials });
  const silent = createLogger('it', () => undefined);
  const reviewRepo = createReviewRepository(ddb, 'ReviewDecisions');
  const catalogRepo = createCatalogRepository(ddb, 'ReportListItems');

  const api = createHttpHandler(
    {
      ...createDecisionRoutes({
        repo: reviewRepo,
        eventBridge,
        busName: 'bus',
        logger: silent,
        publishOptions: { sleep: async () => undefined },
      }),
      ...createGetReviewRoutes({ repo: reviewRepo }),
      ...createUndoRoutes({ repo: reviewRepo, eventBridge, busName: 'bus', logger: silent }),
      ...createListRoutes({ repo: catalogRepo }),
    },
    silent,
  );
  const catalogOnDuplicate = createCatalogOnDuplicate({
    repo: catalogRepo,
    processed: createProcessedEvents(ddb, 'ProcessedEvents', 'catalog-on-duplicate'),
    logger: silent,
  });

  function sentEvents<T>(type: string): EventEnvelope<T>[] {
    return ebMock
      .commandCalls(PutEventsCommand)
      .map((c) => c.args[0].input.Entries?.[0])
      .filter((e) => e?.DetailType === type)
      .map((e) => JSON.parse(e?.Detail ?? '{}') as EventEnvelope<T>);
  }

  const decide = (reportId: string, body: unknown, sub = 'requester-a') =>
    api(
      apiEvent({
        routeKey: 'PUT /v1/reviews/{reportId}/decision',
        claims: requesterClaims(sub),
        pathParameters: { reportId },
        body,
      }),
    );
  const undo = (reportId: string, sub = 'requester-a') =>
    api(
      apiEvent({
        routeKey: 'POST /v1/reviews/{reportId}/decision/undo',
        claims: requesterClaims(sub),
        pathParameters: { reportId },
      }),
    );
  const getReview = (reportId: string, claims: Record<string, string>) =>
    api(
      apiEvent({
        routeKey: 'GET /v1/reviews/{reportId}',
        claims,
        pathParameters: { reportId },
      }),
    );
  const listReports = (query?: Record<string, string>) =>
    api(
      apiEvent({
        routeKey: 'GET /v1/catalog/reports',
        claims: requesterClaims(),
        queryStringParameters: query,
      }),
    );

  beforeAll(async () => {
    // ポートごとに専用のディレクトリにする（skeleton-flow.u1.test.ts と同じパスを共有すると、
    // JAR が未ダウンロードの環境〈CI の初回実行〉で複数の Vitest ワーカーが同時にダウンロード・
    // 展開を試みて競合し、DynamoDB Local が起動できず ECONNREFUSED になる。CI で実際に発生して判明）
    const installPath = fileURLToPath(
      new URL(`../../../node_modules/.cache/dynamodb-local-${PORT}`, import.meta.url),
    );
    mkdirSync(installPath, { recursive: true });
    DynamoDbLocal.configureInstaller({ installPath });
    await DynamoDbLocal.launch(PORT, null, [], false, true);
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
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    for (const t of tables) {
      await raw.send(new DeleteTableCommand({ TableName: t.TableName })).catch(() => undefined);
      await raw.send(new CreateTableCommand(t));
    }
  });

  async function seedChecking(reportId: string, hunterAccountId = 'hunter-a') {
    await reviewRepo.createChecking({
      reportId,
      hunterAccountId,
      status: 'checking',
      submittedAt: '2026-11-23T03:00:00.000Z',
      lastEventAt: '2026-11-23T03:00:00.000Z',
      eventSent: true,
    });
  }

  it('UC15〜UC16: 却下 → 本人が取り消す → もう一度確認できる', async () => {
    await seedChecking('report-u3-1');
    const rejected = await decide('report-u3-1', { decision: 'rejected', reason: 'duplicate' });
    expect(rejected.statusCode).toBe(200);
    expect(JSON.parse(rejected.body ?? '{}')).toMatchObject({
      status: 'rejected',
      reason: 'duplicate',
    });

    const undone = await undo('report-u3-1');
    expect(undone.statusCode).toBe(200);
    expect(JSON.parse(undone.body ?? '{}')).toEqual({
      reportId: 'report-u3-1',
      status: 'checking',
    });

    // 戻したあとは、理由が消えていて、もう一度確認できる（BR3.10）
    const read = await getReview('report-u3-1', requesterClaims());
    expect(JSON.parse(read.body ?? '{}')).toEqual({ reportId: 'report-u3-1', status: 'checking' });
    const approved = await decide('report-u3-1', { decision: 'approved' });
    expect(approved.statusCode).toBe(200);

    const [changed1, changed2] = sentEvents<ReviewStatusChangedData>('review.status-changed');
    expect(changed1?.data).toMatchObject({ status: 'rejected', reason: 'duplicate' });
    expect(changed2?.data).toMatchObject({
      status: 'checking',
      previousStatus: 'rejected',
      undone: true,
    });
  });

  it('UC17: 2 人が同時に却下しても 1 人だけ成功する（US4.6）', async () => {
    await seedChecking('report-u3-2');
    const results = await Promise.all([
      decide('report-u3-2', { decision: 'rejected', reason: 'duplicate' }, 'requester-a'),
      decide('report-u3-2', { decision: 'rejected', reason: 'out-of-scope' }, 'requester-b'),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });

  it('BR3.9: 10 秒を過ぎたら取り消せない（409 UNDO_EXPIRED）', async () => {
    await seedChecking('report-u3-3');
    await decide('report-u3-3', { decision: 'approved' });
    // undoUntil を過去にして期限切れを再現する
    await ddb.send(
      new (await import('@aws-sdk/lib-dynamodb')).UpdateCommand({
        TableName: 'ReviewDecisions',
        Key: { reportId: 'report-u3-3' },
        UpdateExpression: 'SET undoUntil = :past',
        ExpressionAttributeValues: { ':past': '2000-01-01T00:00:00.000Z' },
      }),
    );
    const res = await undo('report-u3-3');
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? '{}').code).toBe('UNDO_EXPIRED');
  });

  it('UC19: 重複の疑いの知らせで印を立て、flag=duplicate の絞り込みに出る（BR4.6・BR4.5）', async () => {
    await seedChecking('report-u3-4');
    await catalogRepo.applySaved(
      {
        reportId: 'report-u3-4',
        hunterAccountId: 'hunter-a',
        hunterName: 'ハンター A',
        species: 'boar',
        capturedAt: '2026-11-23T03:00:00.000Z',
        location: { lat: 35, lng: 135 },
        manualEntry: false,
        submittedAt: '2026-11-23T03:00:00.000Z',
        bodyPhotoId: 'photo-1',
      },
      '2026-11-23T03:00:01.000Z',
    );
    await catalogOnDuplicate(
      busEvent('duplicate.suspected', {
        eventId: 'dup-1',
        type: 'duplicate.suspected',
        version: 1,
        occurredAt: '2026-11-23T03:30:00.000Z',
        source: 'DuplicateDetection',
        data: { reportId: 'report-u3-4', matchedReportId: 'report-u3-9', kind: 'photo' },
      } as never),
    );
    const all = await listReports({ flag: 'duplicate' });
    const body = JSON.parse(all.body ?? '{}') as { items: { reportId: string }[] };
    expect(body.items.map((i) => i.reportId)).toEqual(['report-u3-4']);

    const none = await listReports({ status: 'approved', flag: 'duplicate' });
    expect(JSON.parse(none.body ?? '{}').items).toEqual([]);
  });
});
