// AuditEntries の表の試験（BR12.1〜BR12.4、entities.md）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { createAuditLogRepository, sortKeyOf, type AuditEntryRecord } from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const repo = createAuditLogRepository(ddb, 'AuditEntries');

const entry: Omit<AuditEntryRecord, 'listPartition' | 'sortKey'> = {
  entryId: 'entry-1',
  occurredAt: '2026-11-25T00:00:00.000Z',
  recordedAt: '2026-11-25T00:00:01.000Z',
  actorAccountId: 'requester-a',
  actorName: '市の担当',
  action: 'review.approved',
  targetType: 'report',
  targetId: 'report-1',
  outcome: 'succeeded',
  eventId: 'event-1',
};

beforeEach(() => ddbMock.reset());

describe('putIfAbsent', () => {
  it('eventId を条件にした書き込みで、listPartition・sortKey を組み立てて保存する', async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(repo.putIfAbsent(entry)).resolves.toBe(true);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call?.args[0].input.ConditionExpression).toBe('attribute_not_exists(eventId)');
    expect(call?.args[0].input.Item).toMatchObject({
      listPartition: 'ALL',
      sortKey: sortKeyOf(entry.occurredAt, entry.entryId),
    });
  });

  it('同じ eventId を 2 回受けても 2 件目は何もしない（false。BR12.2）', async () => {
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    await expect(repo.putIfAbsent(entry)).resolves.toBe(false);
  });

  it('条件エラー以外は投げ直す', async () => {
    ddbMock.on(PutCommand).rejects(new Error('boom'));
    await expect(repo.putIfAbsent(entry)).rejects.toThrow('boom');
  });
});

describe('listPage', () => {
  it('新しい順（ScanIndexForward=false）に limit 件読む', async () => {
    ddbMock
      .on(QueryCommand)
      .resolves({ Items: [{ ...entry, listPartition: 'ALL', sortKey: 'x' }] });
    const page = await repo.listPage({ limit: 50 });
    expect(page.items).toHaveLength(1);
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call?.args[0].input.ScanIndexForward).toBe(false);
    expect(call?.args[0].input.Limit).toBe(50);
  });

  it('LastEvaluatedKey があれば cursor を返す', async () => {
    const item = {
      ...entry,
      listPartition: 'ALL',
      sortKey: sortKeyOf(entry.occurredAt, entry.entryId),
    };
    ddbMock.on(QueryCommand).resolves({ Items: [item], LastEvaluatedKey: { entryId: 'entry-1' } });
    const page = await repo.listPage({ limit: 1 });
    expect(page.cursor).toEqual({ entryId: 'entry-1', sortKey: item.sortKey });
  });

  it('LastEvaluatedKey が無ければ cursor は無い（最後のページ）', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const page = await repo.listPage({ limit: 50 });
    expect(page.cursor).toBeUndefined();
  });
});
