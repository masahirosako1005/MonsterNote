// settings 関数の入口の試験（API Gateway の道を持たず、内部の呼び出し専用。BR9.1）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { apiEvent, hunterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  SETTINGS_TABLE: 'Settings',
  // U4: GET/PUT /v1/admin/settings を足したことに伴う追加の環境変数
  EVENT_BUS_NAME: 'monsternote-dev',
  ACCOUNTS_FUNCTION_NAME: 'accounts-function',
};

beforeEach(() => {
  ddbMock.reset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('settings の関数の入口', () => {
  it('kind=settings-read の内部の呼び出しだけを受ける。caller 転送（利用者の証明）は許す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const { handler } = await import('./settings');
    await expect(
      handler({
        kind: 'settings-read',
        auth: { authKind: 'caller', caller: { sub: 'hunter-a', roles: ['hunter'] } },
      }),
    ).resolves.toMatchObject({ duplicateDistanceMeters: 1000, duplicateWindowHours: 24 });
  });

  it('DuplicateDetection の部品の身元の証明は許す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const { handler } = await import('./settings');
    await expect(
      handler({
        kind: 'settings-read',
        auth: { authKind: 'component', component: 'DuplicateDetection' },
      }),
    ).resolves.toMatchObject({ duplicateDistanceMeters: 1000 });
  });

  it('内部の呼び出しでない形は、U4のAPI Gatewayの道として扱う（登録のない道は404）', async () => {
    // U4: settings関数はGET/PUT /v1/admin/settingsのHTTPの道も持つようになったため、
    // 「内部の呼び出し専用」として一律拒むのではなく、登録のない道は404になる
    const { handler } = await import('./settings');
    const res = (await handler(
      apiEvent({ routeKey: 'GET /v1/report-settings', claims: hunterClaims() }),
    )) as { statusCode: number };
    expect(res.statusCode).toBe(404);
  });
});
