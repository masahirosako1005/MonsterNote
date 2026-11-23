// 報告の送信の試験（BR2.1・BR2.3〜BR2.7、AC2.1.1・AC2.1.2・AC2.1.3、reliability-design の送信のキーと eventSent）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { createSubmitRoutes, createEligibilityClient } from './submit';
import { createReportingRepository } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients, fixedNow, reportingTables, sequenceIds } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const lambdaMock = mockClient(LambdaClient);
const c = clients();
const logLines: string[] = [];

const handler = createHttpHandler(
  createSubmitRoutes({
    repo: createReportingRepository(c.ddb, reportingTables),
    eventBridge: c.eventBridge,
    busName: 'monsternote-dev',
    eligibility: createEligibilityClient(c.lambda, 'accounts-fn'),
    logger: createLogger('reporting', (l) => logLines.push(l)),
    now: fixedNow('2026-11-23T03:00:00.000Z'),
    newId: sequenceIds('report-1', 'event-1', 'event-2', 'event-3'),
    publishOptions: { sleep: async () => undefined },
  }),
  createLogger('reporting', () => undefined),
);

const validBody = {
  submissionKey: 'sub-key-0001',
  photos: { body: 'photo-1' },
  location: { lat: 35.0, lng: 135.0 },
  species: 'boar',
  sex: 'male',
};

const uploadedPhoto = {
  photoId: 'photo-1',
  uploadedByAccountId: 'hunter-a',
  kind: 'body',
  storageKey: 'photos/hunter-a/photo-1',
  contentType: 'image/jpeg',
  sizeBytes: 1000,
  uploadStatus: 'uploaded',
  uploadedAt: '2026-11-23T02:59:00.000Z',
};

const savedReport = {
  reportId: 'report-0',
  submissionKey: 'sub-key-0001',
  hunterAccountId: 'hunter-a',
  hunterNumber: '123',
  capturedAt: '2026-11-23T02:00:00.000Z',
  capturedAtSource: 'device',
  location: { lat: 35, lng: 135 },
  locationSource: 'device',
  species: 'boar',
  sex: 'male',
  submittedAt: '2026-11-23T02:00:00.000Z',
  bodyPhotoId: 'photo-1',
  eventSent: false,
};

const eligible = { eligible: true, hunterNumber: '123', displayName: 'ハンター A' };
// Lambda の応答の Payload（実物はバイト列。関数は TextDecoder で読む）
const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

const submit = (body: unknown = validBody, claims = hunterClaims()) =>
  handler(apiEvent({ routeKey: 'POST /v1/reports', claims, body }));
const bodyOf = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;

/** 新しい送信の既定の応答 */
function happyPath() {
  ddbMock.on(GetCommand, { TableName: 'SubmissionKeys' }).resolves({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(GetCommand, { TableName: 'Photos' }).resolves({ Item: uploadedPhoto });
  ddbMock.on(TransactWriteCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
  ddbMock.on(DeleteCommand).resolves({});
  lambdaMock.on(InvokeCommand).resolves({ StatusCode: 200, Payload: payload(eligible) });
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
}

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  lambdaMock.reset();
  logLines.length = 0;
});

describe('POST /v1/reports（新しい送信）', () => {
  it('保存して report.saved を送り、eventSent を「済み」にして 201 と reportId を返す', async () => {
    happyPath();
    const res = await submit();
    expect(res.statusCode).toBe(201);
    expect(bodyOf(res)).toEqual({ reportId: 'report-1' });

    // 送信のキーは最初に「作成中」（期限 30 秒）を条件付きで書く
    const lease = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(lease).toMatchObject({
      TableName: 'SubmissionKeys',
      Item: {
        submissionKey: 'sub-key-0001',
        state: 'creating',
        leaseExpiresAt: '2026-11-23T03:00:30.000Z',
      },
      ConditionExpression: 'attribute_not_exists(submissionKey)',
    });

    // 報告・送信のキー・写真の reportId を 1 つのトランザクションで書く。捕獲日時はサーバーの時刻（BR2.5）
    const tx = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems ?? [];
    expect(tx).toHaveLength(3);
    expect(tx[0]?.Put?.Item).toMatchObject({
      reportId: 'report-1',
      hunterAccountId: 'hunter-a',
      hunterNumber: '123',
      capturedAt: '2026-11-23T03:00:00.000Z',
      capturedAtSource: 'device',
      locationSource: 'device',
      species: 'boar',
      sex: 'male',
      bodyPhotoId: 'photo-1',
      eventSent: false,
    });
    expect(tx[2]?.Update?.Key).toEqual({ photoId: 'photo-1' });

    // report.saved（ハンターの ID と表示名を含む。BR2.7）
    const entry = ebMock.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0];
    const envelope = JSON.parse(entry?.Detail ?? '{}');
    expect(entry?.DetailType).toBe('report.saved');
    expect(envelope).toMatchObject({
      type: 'report.saved',
      source: 'Reporting',
      actorAccountId: 'hunter-a',
      data: {
        reportId: 'report-1',
        hunterAccountId: 'hunter-a',
        hunterName: 'ハンター A',
        species: 'boar',
        manualEntry: false,
        bodyPhotoId: 'photo-1',
      },
    });
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input).toMatchObject({
      TableName: 'Reports',
      Key: { reportId: 'report-1' },
    });
  });

  it('同意か従事者番号がなければ 422 CONSENT_REQUIRED で、送信のキーを放す', async () => {
    happyPath();
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ eligible: false }) });
    const res = await submit();
    expect(res.statusCode).toBe(422);
    expect(bodyOf(res).code).toBe('CONSENT_REQUIRED');
    expect(ddbMock.commandCalls(DeleteCommand)[0]?.args[0].input.Key).toEqual({
      submissionKey: 'sub-key-0001',
    });
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('自分の写真でない・アップロードが終わっていない・結び付き済みの写真は 422', async () => {
    for (const photo of [
      { ...uploadedPhoto, uploadedByAccountId: 'hunter-b' },
      { ...uploadedPhoto, uploadStatus: 'pending' },
      { ...uploadedPhoto, reportId: 'other' },
      undefined,
    ]) {
      ddbMock.reset();
      happyPath();
      ddbMock.on(GetCommand, { TableName: 'Photos' }).resolves({ Item: photo });
      const res = await submit();
      expect(res.statusCode).toBe(422);
      expect(bodyOf(res).code).toBe('VALIDATION_FAILED');
    }
  });

  it('必須の項目（全身の写真・種類・雌雄・位置）がなければ 400 で、足りない項目を details に入れる', async () => {
    happyPath();
    const res = await submit({
      submissionKey: 'sub-key-0001',
      photos: { body: 'photo-1' },
      species: 'cat',
      location: { lat: 999, lng: 135 },
    });
    expect(res.statusCode).toBe(400);
    const fields = (bodyOf(res).details as { field: string }[]).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['species', 'sex', 'location']));

    const noPhoto = await submit({ ...validBody, photos: {} });
    expect(noPhoto.statusCode).toBe(400);
  });

  it('送信のキーがなければ 400、依頼元は 403', async () => {
    expect((await submit({ ...validBody, submissionKey: '' })).statusCode).toBe(400);
    expect((await submit(validBody, requesterClaims())).statusCode).toBe(403);
  });

  it('report.saved を 3 回とも送れなければ 500 にし、ログに EVENT_PUBLISH_FAILED を出す', async () => {
    happyPath();
    ebMock.on(PutEventsCommand).rejects(new Error('down'));
    const res = await submit();
    expect(res.statusCode).toBe(500);
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(3);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    expect(logLines.some((l) => l.includes('EVENT_PUBLISH_FAILED'))).toBe(true);
  });

  it('Accounts の呼び出し（C10）が失敗したら 500', async () => {
    happyPath();
    lambdaMock.on(InvokeCommand).resolves({ FunctionError: 'Unhandled', Payload: payload({}) });
    expect((await submit()).statusCode).toBe(500);
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1);
  });

  it('同時の送信で「作成中」を書けなかったら 409 SUBMISSION_IN_PROGRESS', async () => {
    happyPath();
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const res = await submit();
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res)).toMatchObject({
      code: 'SUBMISSION_IN_PROGRESS',
      conflict: { retryAfterSeconds: 2 },
    });
  });
});

describe('POST /v1/reports（同じ送信のキーの送り直し。BR2.6）', () => {
  it('保存済みで知らせも「済み」なら、ほかの確認をせず 200 で同じ reportId', async () => {
    ddbMock.on(GetCommand, { TableName: 'SubmissionKeys' }).resolves({
      Item: {
        submissionKey: 'sub-key-0001',
        hunterAccountId: 'hunter-a',
        state: 'saved',
        reportId: 'report-0',
      },
    });
    ddbMock
      .on(GetCommand, { TableName: 'Reports' })
      .resolves({ Item: { ...savedReport, eventSent: true } });
    const res = await submit();
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toEqual({ reportId: 'report-0' });
    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(0);
  });

  it('保存済みで知らせが「まだ」なら、送り直してから 200', async () => {
    ddbMock.on(GetCommand, { TableName: 'SubmissionKeys' }).resolves({
      Item: {
        submissionKey: 'sub-key-0001',
        hunterAccountId: 'hunter-a',
        state: 'saved',
        reportId: 'report-0',
      },
    });
    ddbMock.on(GetCommand, { TableName: 'Reports' }).resolves({ Item: savedReport });
    ddbMock.on(UpdateCommand).resolves({});
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload(eligible) });
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const res = await submit();
    expect(res.statusCode).toBe(200);
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.Key).toEqual({
      reportId: 'report-0',
    });
  });

  it('作成中で期限内なら 409、期限切れなら取り直して最初から処理する', async () => {
    ddbMock.on(GetCommand, { TableName: 'SubmissionKeys' }).resolves({
      Item: {
        submissionKey: 'sub-key-0001',
        hunterAccountId: 'hunter-a',
        state: 'creating',
        leaseExpiresAt: '2026-11-23T03:00:10.000Z',
      },
    });
    expect((await submit()).statusCode).toBe(409);

    ddbMock.reset();
    happyPath();
    ddbMock.on(GetCommand, { TableName: 'SubmissionKeys' }).resolves({
      Item: {
        submissionKey: 'sub-key-0001',
        hunterAccountId: 'hunter-a',
        state: 'creating',
        leaseExpiresAt: '2026-11-23T02:59:00.000Z',
      },
    });
    const res = await submit();
    expect(res.statusCode).toBe(201);
    const takeOver = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(takeOver).toMatchObject({
      TableName: 'SubmissionKeys',
      ExpressionAttributeValues: { ':previous': '2026-11-23T02:59:00.000Z' },
    });
  });

  it('ほかのハンターの送信のキーは使えない（400）', async () => {
    ddbMock.on(GetCommand, { TableName: 'SubmissionKeys' }).resolves({
      Item: {
        submissionKey: 'sub-key-0001',
        hunterAccountId: 'hunter-b',
        state: 'saved',
        reportId: 'x',
      },
    });
    expect((await submit()).statusCode).toBe(400);
  });
});
