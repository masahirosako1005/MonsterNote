// 関数の入口のつなぎ方の試験（環境変数から部品を組み立て、道と知らせを正しい処理に渡す）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { requireEnv } from '../shared/env';
import { apiEvent, busEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  ACCOUNTS_TABLE: 'Accounts',
  USER_POOL_CLIENT_ID: 'client-1',
  PHOTOS_TABLE: 'Photos',
  REPORTS_TABLE: 'Reports',
  SUBMISSION_KEYS_TABLE: 'SubmissionKeys',
  PHOTO_BUCKET: 'photo-bucket',
  EVENT_BUS_NAME: 'monsternote-dev',
  ACCOUNTS_FUNCTION_NAME: 'accounts-fn',
  REVIEW_DECISIONS_TABLE: 'ReviewDecisions',
  REPORT_LIST_ITEMS_TABLE: 'ReportListItems',
  PROCESSED_EVENTS_TABLE: 'ProcessedEvents',
  DETECTION_RESULTS_TABLE: 'DetectionResults',
  DETECTION_RATE_LIMITS_TABLE: 'DetectionRateLimits',
  REPORT_FOOTPRINTS_TABLE: 'ReportFootprints',
  DUPLICATE_SUSPICIONS_TABLE: 'DuplicateSuspicions',
  SETTINGS_TABLE: 'Settings',
  SETTINGS_FUNCTION_NAME: 'settings-fn',
  DUPLICATE_DETECTION_FUNCTION_NAME: 'duplicate-detection-fn',
};

beforeEach(() => {
  ddbMock.reset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('requireEnv', () => {
  it('環境変数がなければ止める', () => {
    expect(() => requireEnv('MISSING', {})).toThrow('環境変数 MISSING がありません');
    expect(requireEnv('X', { X: 'v' })).toBe('v');
  });
});

describe('関数の入口', () => {
  it('accounts: 直接の呼び出し（C10）と API の道を見分ける', async () => {
    const { handler } = await import('./accounts');
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(
      handler({
        kind: 'report-eligibility',
        accountId: 'h',
        caller: { sub: 'h', roles: ['hunter'] },
      }),
    ).resolves.toEqual({ eligible: false });
    const res = (await handler(
      apiEvent({ routeKey: 'POST /v1/session', claims: undefined, body: {} }),
    )) as {
      statusCode: number;
    };
    expect(res.statusCode).toBe(400);
  });

  it('reporting: 写真・報告・詳細の道を持つ', async () => {
    const { handler } = await import('./reporting');
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await handler(
      apiEvent({
        routeKey: 'GET /v1/reports/{reportId}',
        claims: hunterClaims(),
        pathParameters: { reportId: 'x' },
      }),
    );
    expect(res.statusCode).toBe(404);
    const photos = await handler(
      apiEvent({ routeKey: 'POST /v1/photos', claims: requesterClaims(), body: {} }),
    );
    expect(photos.statusCode).toBe(403);
  });

  it('review: 承認と状態の道を持つ', async () => {
    const { handler } = await import('./review');
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await handler(
      apiEvent({
        routeKey: 'GET /v1/reviews/{reportId}',
        claims: requesterClaims(),
        pathParameters: { reportId: 'x' },
      }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('catalog: 一覧の道を持つ', async () => {
    const { handler } = await import('./catalog');
    ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });
    const res = await handler(
      apiEvent({ routeKey: 'GET /v1/catalog/my-reports', claims: hunterClaims() }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('知らせの受け手: それぞれ自分の表に書く', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});
    const saved = {
      eventId: 'e1',
      type: 'report.saved',
      version: 1,
      occurredAt: '2026-11-23T03:00:00.000Z',
      source: 'Reporting',
      data: {
        reportId: 'r1',
        hunterAccountId: 'h',
        hunterName: 'n',
        species: 'deer',
        capturedAt: '2026-11-23T03:00:00.000Z',
        location: { lat: 1, lng: 1 },
        manualEntry: false,
        submittedAt: '2026-11-23T03:00:00.000Z',
        bodyPhotoId: 'p',
      },
    };
    const reviewOnSaved = (await import('./review-on-saved')).handler;
    const catalogOnSaved = (await import('./catalog-on-saved')).handler;
    const catalogOnStatus = (await import('./catalog-on-status')).handler;
    await reviewOnSaved(busEvent('report.saved', saved as never));
    await catalogOnSaved(busEvent('report.saved', saved as never));
    await catalogOnStatus(
      busEvent('review.status-changed', {
        ...saved,
        eventId: 'e2',
        type: 'review.status-changed',
        data: {
          reportId: 'r1',
          status: 'approved',
          previousStatus: 'checking',
          changedAt: saved.occurredAt,
        },
      } as never),
    );
    expect(ddbMock.commandCalls(PutCommand, { TableName: 'ReviewDecisions' })).toHaveLength(1);
    expect(ddbMock.commandCalls(UpdateCommand, { TableName: 'ReportListItems' })).toHaveLength(2);
  });
});
