// PUT /v1/admin/settings の試験（BR9.2・BR9.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createUpdateSettingsRoute } from './update-settings';
import { createSettingsRepository } from './repository';
import { createLogger } from '../shared/logger';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const repo = createSettingsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Settings',
);
const eventBridge = new EventBridgeClient({ region: 'ap-northeast-1' });
const now = () => new Date('2026-11-25T00:00:00.000Z');
const logger = createLogger('settings', () => undefined);

const validBody = {
  duplicateDistanceMeters: 500,
  duplicateWindowHours: 12,
  targetAreaNorth: 40,
  targetAreaSouth: 30,
  targetAreaEast: 140,
  targetAreaWest: 130,
};

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
});

describe('createUpdateSettingsRoute', () => {
  it('保存し、updatedByAccountId・updatedAtを記録してaudit.recordedを送る（BR9.4）', async () => {
    ddbMock.on(PutCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createUpdateSettingsRoute({ repo, eventBridge, busName: 'bus', logger, now });
    const res = await route(
      apiEvent({
        routeKey: 'PUT /v1/admin/settings',
        body: validBody,
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]', name: '管理者A' },
      }),
    );
    expect(res.statusCode).toBe(204);
    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item;
    expect(put).toMatchObject({ ...validBody, updatedByAccountId: 'admin-a' });
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(1);
  });

  it('距離が0以下なら422（AC6.4.3）', async () => {
    const route = createUpdateSettingsRoute({ repo, eventBridge, busName: 'bus', logger, now });
    await expect(
      route(
        apiEvent({
          routeKey: 'PUT /v1/admin/settings',
          body: { ...validBody, duplicateDistanceMeters: 0 },
          claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 422 }));
  });

  it('北<=南なら422', async () => {
    const route = createUpdateSettingsRoute({ repo, eventBridge, busName: 'bus', logger, now });
    await expect(
      route(
        apiEvent({
          routeKey: 'PUT /v1/admin/settings',
          body: { ...validBody, targetAreaNorth: 20, targetAreaSouth: 30 },
          claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 422 }));
  });

  it('管理者でなければ403', async () => {
    const route = createUpdateSettingsRoute({ repo, eventBridge, busName: 'bus', logger, now });
    await expect(
      route(
        apiEvent({
          routeKey: 'PUT /v1/admin/settings',
          body: validBody,
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
