// duplicate-detection 関数の入口の試験（C5 GET /v1/duplicates/{reportId}・C9 内部の呼び出しの見分け）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import type { HttpResult } from '../shared/http';
import { apiEvent, requesterClaims, hunterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  REPORT_FOOTPRINTS_TABLE: 'ReportFootprints',
  DUPLICATE_SUSPICIONS_TABLE: 'DuplicateSuspicions',
  REVIEW_DECISIONS_TABLE: 'ReviewDecisions',
  SETTINGS_FUNCTION_NAME: 'settings-fn',
  // U4: すべて削除・mustChangePasswordゲートを足したことに伴う追加の環境変数
  EVENT_BUS_NAME: 'monsternote-dev',
  ACCOUNTS_FUNCTION_NAME: 'accounts-fn',
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
  lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: false }) });
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('duplicate-detection の関数の入口', () => {
  it('GET /v1/duplicates/{reportId}: 依頼元は疑いの一覧と相手の状態を読める（BR8.9・D-6）', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          suspicionId: 'r1#r2#place-time',
          reportId: 'r1',
          matchedReportId: 'r2',
          kind: 'place-time',
          distanceMeters: 300,
          hoursApart: 1,
          phase: 'post-save',
          detectedAt: '2026-11-20T00:00:00.000Z',
        },
      ],
    });
    ddbMock.on(GetCommand).resolves({ Item: { reportId: 'r2', status: 'approved' } });
    const { handler } = await import('./duplicate-detection');
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/duplicates/{reportId}',
        claims: requesterClaims(),
        pathParameters: { reportId: 'r1' },
      }),
    )) as HttpResult;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}') as { matches: { matchedStatus: string }[] };
    expect(body.matches[0]?.matchedStatus).toBe('approved');
  });

  it('GET /v1/duplicates/{reportId}: ハンターは拒む（403）', async () => {
    const { handler } = await import('./duplicate-detection');
    const res = (await handler(
      apiEvent({
        routeKey: 'GET /v1/duplicates/{reportId}',
        claims: hunterClaims(),
        pathParameters: { reportId: 'r1' },
      }),
    )) as HttpResult;
    expect(res.statusCode).toBe(403);
  });

  it('kind=duplicate-check の内部の呼び出しは、ハンターの証明の転送を確かめてから判定する（C9）', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload(settingsRecord) });
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const { handler } = await import('./duplicate-detection');
    const result = await handler({
      kind: 'duplicate-check',
      auth: { authKind: 'caller', caller: { sub: 'hunter-a', roles: ['hunter'] } },
      species: 'boar',
      capturedAt: '2026-11-20T00:00:00.000Z',
      location: { lat: 35, lng: 135 },
    });
    expect(result).toEqual({ suspected: false, matches: [] });
    expect(lambdaMock.commandCalls(InvokeCommand)[0]?.args[0].input.FunctionName).toBe(
      'settings-fn',
    );
  });

  it('kind=duplicate-check でハンターでない証明は拒む', async () => {
    const { handler } = await import('./duplicate-detection');
    await expect(
      handler({
        kind: 'duplicate-check',
        auth: { authKind: 'caller', caller: { sub: 'requester-a', roles: ['requester'] } },
        species: 'boar',
        capturedAt: '2026-11-20T00:00:00.000Z',
        location: { lat: 35, lng: 135 },
      }),
    ).rejects.toThrow();
  });

  it('kind=duplicate-check で部品の身元の証明（caller がない）は拒む', async () => {
    const { handler } = await import('./duplicate-detection');
    await expect(
      handler({
        kind: 'duplicate-check',
        auth: { authKind: 'component', component: 'DuplicateDetection' },
        species: 'boar',
        capturedAt: '2026-11-20T00:00:00.000Z',
        location: { lat: 35, lng: 135 },
      }),
    ).rejects.toThrow('利用者の証明を要ります');
  });
});
