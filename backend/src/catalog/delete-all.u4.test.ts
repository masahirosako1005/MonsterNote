// POST /v1/admin/catalog-data の試験（BR13.1の順番①）
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
const logger = createLogger('catalog', () => undefined);
const now = () => new Date('2026-11-25T00:00:00.000Z');

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
});

describe('createDeleteAllRoute (catalog)', () => {
  it('0件でも成功し、audit.recorded（data.deleted）を送る', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createDeleteAllRoute({
      ddb,
      tableName: 'ReportListItems',
      eventBridge,
      busName: 'bus',
      logger,
      now,
    });
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/catalog-data',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toEqual({ deletedCount: 0 });
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(0);
    const entry = JSON.parse(
      ebMock.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0]?.Detail ?? '{}',
    );
    expect(entry.data).toMatchObject({ action: 'data.deleted', targetType: 'data' });
    expect(entry.data.detail).toMatchObject({ componentName: 'catalog', deletedCount: 0 });
  });

  it('件数を消して返す', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ reportId: 'r1' }, { reportId: 'r2' }] });
    ddbMock.on(BatchWriteCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const route = createDeleteAllRoute({
      ddb,
      tableName: 'ReportListItems',
      eventBridge,
      busName: 'bus',
      logger,
      now,
    });
    const res = await route(
      apiEvent({
        routeKey: 'POST /v1/admin/catalog-data',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    expect(JSON.parse(res.body ?? '')).toEqual({ deletedCount: 2 });
  });

  it('管理者でなければ403', async () => {
    const route = createDeleteAllRoute({
      ddb,
      tableName: 'ReportListItems',
      eventBridge,
      busName: 'bus',
      logger,
      now,
    });
    await expect(
      route(
        apiEvent({
          routeKey: 'POST /v1/admin/catalog-data',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
