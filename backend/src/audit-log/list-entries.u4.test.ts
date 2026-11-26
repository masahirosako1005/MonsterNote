// GET /v1/admin/audit-entries の試験（BR12.1・BR12.3・AC6.6.3）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createListEntriesRoute, decodeCursor, encodeCursor } from './list-entries';
import { createAuditLogRepository, type AuditEntryRecord } from './repository';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createAuditLogRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'AuditEntries',
);

const entry: AuditEntryRecord = {
  entryId: 'event-1',
  occurredAt: '2026-11-25T00:00:00.000Z',
  recordedAt: '2026-11-25T00:00:01.000Z',
  actorAccountId: 'req-1',
  actorName: '市の担当',
  action: 'review.approved',
  targetType: 'report',
  targetId: 'report-1',
  outcome: 'succeeded',
  eventId: 'event-1',
};

beforeEach(() => ddbMock.reset());

describe('encodeCursor / decodeCursor', () => {
  it('往復できる', () => {
    const c = { entryId: 'a', sortKey: 'b' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('壊れたcursorは検証エラー', () => {
    expect(() => decodeCursor('not-base64-json')).toThrow();
  });
});

describe('createListEntriesRoute', () => {
  it('利用者のIDを出さず、actorNameだけ返す（AC6.6.3）', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [entry] });
    const route = createListEntriesRoute({ repo });
    const res = await route(
      apiEvent({
        routeKey: 'GET /v1/admin/audit-entries',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    const body = JSON.parse(res.body ?? '');
    expect(body.items[0]).toEqual({
      entryId: 'event-1',
      occurredAt: '2026-11-25T00:00:00.000Z',
      actorName: '市の担当',
      action: 'review.approved',
      targetType: 'report',
      targetId: 'report-1',
      outcome: 'succeeded',
      detail: undefined,
    });
    expect(JSON.stringify(body)).not.toContain('req-1');
  });

  it('次のページの位置を返す', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [entry], LastEvaluatedKey: { entryId: 'event-1' } });
    const route = createListEntriesRoute({ repo });
    const res = await route(
      apiEvent({
        routeKey: 'GET /v1/admin/audit-entries',
        claims: { sub: 'admin-a', 'cognito:groups': '[admin]' },
      }),
    );
    const body = JSON.parse(res.body ?? '');
    expect(body.nextCursor).not.toBeNull();
  });

  it('管理者でなければ403', async () => {
    const route = createListEntriesRoute({ repo });
    await expect(
      route(
        apiEvent({
          routeKey: 'GET /v1/admin/audit-entries',
          claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]' },
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });
});
