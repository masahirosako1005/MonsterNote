// DuplicateDetection の表（ReportFootprints・DuplicateSuspicions）の読み書き。entities.md の ReportFootprint・DuplicateSuspicion。
// 索引（ReportFootprint）は speciesDay（種類#捕獲日）の GSI で前後3日分を読む（BR8.3）。
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';
import type { Species } from '../species-detection/repository';

export const SPECIES_DAY_INDEX = 'speciesDay';
export const BY_REPORT_INDEX = 'byReportId';

export type SuspicionKind = 'place-time' | 'photo' | 'moon-ring';
export type SuspicionPhase = 'pre-submit' | 'post-save';

export interface ReportFootprintRecord {
  reportId: string;
  savedReceived: boolean;
  species?: Species;
  location?: { lat: number; lng: number };
  capturedAt?: string;
  /** 索引のキー。例 boar#2026-11-20（savedReceived=true のときだけ持つ。BR8.11） */
  speciesDay?: string;
  active: boolean;
  photoHash?: string;
  hunterAccountId?: string;
  addedAt: string;
  lastSavedEventAt?: string;
  lastStatusEventAt?: string;
}

export interface DuplicateSuspicionRecord {
  suspicionId: string;
  reportId: string;
  matchedReportId: string;
  kind: SuspicionKind;
  distanceMeters?: number;
  hoursApart?: number;
  phase: SuspicionPhase;
  detectedAt: string;
}

export interface DuplicateTables {
  footprints: string;
  suspicions: string;
}

export type DuplicateRepository = ReturnType<typeof createDuplicateRepository>;

export function createDuplicateRepository(ddb: DynamoDBDocumentClient, tables: DuplicateTables) {
  return {
    async getFootprint(reportId: string): Promise<ReportFootprintRecord | undefined> {
      const res = await ddb.send(
        new GetCommand({ TableName: tables.footprints, Key: { reportId } }),
      );
      return res.Item as ReportFootprintRecord | undefined;
    },

    /** 索引に作る・更新する（条件なし。呼ぶ側が知らせの順番〈BR8.11〉を組み立てて渡す） */
    async putFootprint(record: ReportFootprintRecord): Promise<void> {
      await ddb.send(new PutCommand({ TableName: tables.footprints, Item: record }));
    },

    /** 種類＋捕獲日のキーで、その日の索引を 1 ページ読む（performance-design §3: 500 件で打ち切り） */
    async queryBySpeciesDay(speciesDay: string, limit: number): Promise<ReportFootprintRecord[]> {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tables.footprints,
          IndexName: SPECIES_DAY_INDEX,
          KeyConditionExpression: 'speciesDay = :speciesDay',
          ExpressionAttributeValues: { ':speciesDay': speciesDay },
          Limit: limit,
        }),
      );
      return (res.Items ?? []) as ReportFootprintRecord[];
    },

    /** 同じ組を作り直さない（suspicionId の一意性。BR8.6）。すでにあれば false */
    async putSuspicionIfAbsent(record: DuplicateSuspicionRecord): Promise<boolean> {
      try {
        await ddb.send(
          new PutCommand({
            TableName: tables.suspicions,
            Item: record,
            ConditionExpression: 'attribute_not_exists(suspicionId)',
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    /** 報告 1 件分の疑いの一覧（GET /v1/duplicates/{reportId}。BR8.9。reportId の GSI で読む） */
    async listSuspicionsByReport(reportId: string): Promise<DuplicateSuspicionRecord[]> {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tables.suspicions,
          IndexName: BY_REPORT_INDEX,
          KeyConditionExpression: 'reportId = :reportId',
          ExpressionAttributeValues: { ':reportId': reportId },
        }),
      );
      return (res.Items ?? []) as DuplicateSuspicionRecord[];
    },
  };
}
