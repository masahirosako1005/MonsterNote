// AuditEntries の表の読み書き。entities.md の AuditEntry（BR12.1〜BR12.4）。
// 索引 gsiAll: 固定のパーティション（listPartition='ALL'）＋ sortKey（occurredAt#entryId）で新しい順に読む。
// 書き換え・削除の入口は一切作らない（BR12.4）。
import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';

export const ALL_PARTITION = 'ALL';
export const INDEX_ALL = 'gsiAll';

export type AuditTargetType = 'report' | 'account' | 'settings' | 'data';
export type AuditOutcome = 'succeeded' | 'failed';

export interface AuditEntryRecord {
  entryId: string;
  occurredAt: string;
  recordedAt: string;
  actorAccountId?: string;
  actorName?: string;
  action: string;
  targetType: AuditTargetType;
  targetId?: string;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
  eventId: string;
  listPartition?: string;
  sortKey?: string;
}

export interface Cursor {
  entryId: string;
  sortKey: string;
}

export function sortKeyOf(occurredAt: string, entryId: string): string {
  return `${occurredAt}#${entryId}`;
}

export interface AuditLogPageQuery {
  limit: number;
  startAfter?: Cursor;
}

export interface AuditLogPage {
  items: AuditEntryRecord[];
  cursor?: Cursor;
}

export interface AuditLogRepository {
  /** eventId を条件にした 1 回の書き込み（BR12.2）。すでにあれば false（何もしない） */
  putIfAbsent(entry: Omit<AuditEntryRecord, 'listPartition' | 'sortKey'>): Promise<boolean>;
  listPage(query: AuditLogPageQuery): Promise<AuditLogPage>;
}

export function createAuditLogRepository(
  ddb: DynamoDBDocumentClient,
  tableName: string,
): AuditLogRepository {
  return {
    async putIfAbsent(entry) {
      const item: AuditEntryRecord = {
        ...entry,
        listPartition: ALL_PARTITION,
        sortKey: sortKeyOf(entry.occurredAt, entry.entryId),
      };
      try {
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(eventId)',
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },
    async listPage({ limit, startAfter }) {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: INDEX_ALL,
          KeyConditionExpression: 'listPartition = :p',
          ExpressionAttributeValues: { ':p': ALL_PARTITION },
          ScanIndexForward: false,
          Limit: limit,
          ExclusiveStartKey: startAfter
            ? {
                entryId: startAfter.entryId,
                listPartition: ALL_PARTITION,
                sortKey: startAfter.sortKey,
              }
            : undefined,
        }),
      );
      const items = (res.Items ?? []) as AuditEntryRecord[];
      const last = items[items.length - 1];
      const cursor =
        res.LastEvaluatedKey && last
          ? { entryId: last.entryId, sortKey: last.sortKey! }
          : undefined;
      return { items, cursor };
    },
  };
}
