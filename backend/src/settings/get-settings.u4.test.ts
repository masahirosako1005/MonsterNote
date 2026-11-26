// GET /v1/admin/settings の試験（UC25）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createGetSettingsRoute } from './get-settings';
import { createSettingsRepository } from './repository';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createSettingsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Settings',
);
const now = () => new Date('2026-11-25T00:00:00.000Z');

beforeEach(() => ddbMock.reset());

describe('createGetSettingsRoute', () => {
  it('設定がまだなければ初期値を返す（BR9.3）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const route = createGetSettingsRoute({ repo, now });
    const res = await route(
      apiEvent({
        routeKey: 'GET /v1/admin/settings',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    const body = JSON.parse(res.body ?? '');
    expect(body).toMatchObject({ duplicateDistanceMeters: 1000, duplicateWindowHours: 24 });
  });

  it('保存済みの値を返す', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        settingKey: 'default',
        duplicateDistanceMeters: 500,
        duplicateWindowHours: 12,
        targetAreaNorth: 40,
        targetAreaSouth: 30,
        targetAreaEast: 140,
        targetAreaWest: 130,
        updatedByAccountId: 'admin-a',
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
    });
    const route = createGetSettingsRoute({ repo, now });
    const res = await route(
      apiEvent({
        routeKey: 'GET /v1/admin/settings',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toMatchObject({ duplicateDistanceMeters: 500 });
  });

  it('管理者でなければ403', async () => {
    const route = createGetSettingsRoute({ repo, now });
    await expect(
      route(
        apiEvent({
          routeKey: 'GET /v1/admin/settings',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
