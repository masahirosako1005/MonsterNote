// ReportCatalog の表（ReportListItems）の読み書き。entities.md の ReportListItem、BR4.1〜BR4.4。
// 索引: gsiAll（固定のパーティション listPartition='ALL' ＋ sortKey）、gsiHunter（hunterAccountId ＋ sortKey）。
// sortKey は `submittedAt#reportId`。report.saved が届くまで sortKey を書かないため、状態だけの行は索引に入らない。
import { QueryCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';
import type { ReportSavedData } from '../shared/events';

export const ALL_PARTITION = 'ALL';
export const INDEX_ALL = 'gsiAll';
export const INDEX_HUNTER = 'gsiHunter';

export type ListStatus = 'checking' | 'approved' | 'rejected';

export interface ReportListItemRecord {
  reportId: string;
  hunterAccountId?: string;
  hunterName?: string;
  species?: 'bear' | 'boar' | 'deer';
  capturedAt?: string;
  placeName?: string;
  status: ListStatus;
  duplicateSuspected: boolean;
  manualEntry: boolean;
  submittedAt?: string;
  savedReceived: boolean;
  lastSavedEventAt?: string;
  lastStatusEventAt?: string;
  listPartition?: string;
  sortKey?: string;
}

export interface ListPageQuery {
  index: typeof INDEX_ALL | typeof INDEX_HUNTER;
  partitionValue: string;
  limit: number;
  startAfter?: { reportId: string; sortKey: string };
}

export function sortKeyOf(submittedAt: string, reportId: string): string {
  return `${submittedAt}#${reportId}`;
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;

export function createCatalogRepository(ddb: DynamoDBDocumentClient, tableName: string) {
  const partitionAttr = (index: ListPageQuery['index']) =>
    index === INDEX_ALL ? 'listPartition' : 'hunterAccountId';

  return {
    /** report.saved の内容を入れる。より新しい report.saved を反映済みなら false */
    async applySaved(data: ReportSavedData, occurredAt: string): Promise<boolean> {
      const placeName = data.placeName ? ', placeName = :placeName' : '';
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { reportId: data.reportId },
            UpdateExpression:
              'SET hunterAccountId = :hunterAccountId, hunterName = :hunterName, species = :species, ' +
              'capturedAt = :capturedAt, submittedAt = :submittedAt, manualEntry = :manualEntry, ' +
              'savedReceived = :savedReceived, lastSavedEventAt = :occurredAt, ' +
              'listPartition = :listPartition, sortKey = :sortKey, ' +
              '#status = if_not_exists(#status, :checking), ' +
              'duplicateSuspected = if_not_exists(duplicateSuspected, :false)' +
              placeName,
            ConditionExpression:
              'attribute_not_exists(lastSavedEventAt) OR lastSavedEventAt < :occurredAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':hunterAccountId': data.hunterAccountId,
              ':hunterName': data.hunterName,
              ':species': data.species,
              ':capturedAt': data.capturedAt,
              ':submittedAt': data.submittedAt,
              ':manualEntry': data.manualEntry,
              ':savedReceived': true,
              ':occurredAt': occurredAt,
              ':listPartition': ALL_PARTITION,
              ':sortKey': sortKeyOf(data.submittedAt, data.reportId),
              ':checking': 'checking',
              ':false': false,
              ...(data.placeName ? { ':placeName': data.placeName } : {}),
            },
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    /** 状態を書き換える。最後に反映した状態の知らせより古ければ false */
    async applyStatus(reportId: string, status: ListStatus, occurredAt: string): Promise<boolean> {
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { reportId },
            UpdateExpression:
              'SET #status = :status, lastStatusEventAt = :occurredAt, ' +
              'savedReceived = if_not_exists(savedReceived, :false), ' +
              'duplicateSuspected = if_not_exists(duplicateSuspected, :false), ' +
              'manualEntry = if_not_exists(manualEntry, :false)',
            ConditionExpression:
              'attribute_not_exists(lastStatusEventAt) OR lastStatusEventAt < :occurredAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': status,
              ':occurredAt': occurredAt,
              ':false': false,
            },
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    /** 索引の 1 回のクエリで、送信の新しい順に limit + 1 件まで読む（次のページがあるかを知るため） */
    async listPage(query: ListPageQuery): Promise<ReportListItemRecord[]> {
      const pk = partitionAttr(query.index);
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: query.index,
          KeyConditionExpression: '#pk = :pk',
          ExpressionAttributeNames: { '#pk': pk },
          ExpressionAttributeValues: { ':pk': query.partitionValue },
          ScanIndexForward: false,
          Limit: query.limit + 1,
          ...(query.startAfter
            ? {
                ExclusiveStartKey: {
                  reportId: query.startAfter.reportId,
                  sortKey: query.startAfter.sortKey,
                  [pk]: query.partitionValue,
                },
              }
            : {}),
        }),
      );
      return (res.Items ?? []) as ReportListItemRecord[];
    },

    /** その一覧の対象の全件数（索引に入るのは savedReceived の行だけ） */
    async count(index: ListPageQuery['index'], partitionValue: string): Promise<number> {
      let total = 0;
      let startKey: Record<string, unknown> | undefined;
      do {
        const res = await ddb.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: index,
            KeyConditionExpression: '#pk = :pk',
            ExpressionAttributeNames: { '#pk': partitionAttr(index) },
            ExpressionAttributeValues: { ':pk': partitionValue },
            Select: 'COUNT',
            ExclusiveStartKey: startKey,
          }),
        );
        total += res.Count ?? 0;
        startKey = res.LastEvaluatedKey;
      } while (startKey);
      return total;
    },
  };
}
