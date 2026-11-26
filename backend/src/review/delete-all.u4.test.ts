// POST /v1/admin/review-data の試験（BR13.1の順番②）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createDeleteAllRoute } from './delete-all';
import { createLogger } from '../shared/logger';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const eventBridge = new EventBridgeClient({ region: 'ap-northeast-1' });
const logger = createLogger('review', () => undefined);
const now = () => new Date('2026-11-25T00:00:00.000Z');

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
});

describe('createDeleteAllRoute (review)', () => {
  it('ReviewDecisionsを全件消し、audit.recordedを送る', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ reportId: 'r1' }] });
    ddbMock.on(BatchWriteCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createDeleteAllRoute({
      ddb,
      tableName: 'ReviewDecisions',
      eventBridge,
      busName: 'bus',
      logger,
      now,
    });
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/review-data',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toEqual({ deletedCount: 1 });
    const call = ddbMock.commandCalls(BatchWriteCommand)[0]?.args[0].input.RequestItems;
    expect(call?.ReviewDecisions).toHaveLength(1);
  });

  it('管理者でなければ403', async () => {
    const route = createDeleteAllRoute({
      ddb,
      tableName: 'ReviewDecisions',
      eventBridge,
      busName: 'bus',
      logger,
      now,
    });
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/review-data',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
