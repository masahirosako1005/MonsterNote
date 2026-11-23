// 一覧（C4 GET /v1/catalog/reports・GET /v1/catalog/my-reports）。
// BR4.2: 依頼元はすべての報告、BR4.3: ハンターは自分の報告。どちらも送信の新しい順に 50 件。
// BR4.4: cursor は前のページの最後の行の（submittedAt、reportId）を表す、画面が中身を読まない文字列。壊れていたら 400。
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type HttpEvent, type RouteHandler } from '../shared/http';
import {
  ALL_PARTITION,
  INDEX_ALL,
  INDEX_HUNTER,
  type CatalogRepository,
  type ListPageQuery,
  type ReportListItemRecord,
} from './repository';

export const PAGE_SIZE = 50;

interface Cursor {
  reportId: string;
  sortKey: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  const invalid = () => errors.validation([{ field: 'cursor', reason: 'invalid' }]);
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) throw invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const c = parsed as Partial<Cursor> | null;
  if (
    typeof c !== 'object' ||
    c === null ||
    typeof c.reportId !== 'string' ||
    typeof c.sortKey !== 'string' ||
    !c.sortKey.endsWith(`#${c.reportId}`)
  ) {
    throw invalid();
  }
  return { reportId: c.reportId, sortKey: c.sortKey };
}

/** 画面に返す一覧の行（索引のキーなど内部の項目は出さない） */
function itemView(row: ReportListItemRecord) {
  return {
    reportId: row.reportId,
    hunterName: row.hunterName,
    species: row.species,
    capturedAt: row.capturedAt,
    placeName: row.placeName ?? null,
    status: row.status,
    duplicateSuspected: row.duplicateSuspected,
    manualEntry: row.manualEntry,
    submittedAt: row.submittedAt,
  };
}

export function createListRoutes(deps: { repo: CatalogRepository }): Record<string, RouteHandler> {
  async function page(event: HttpEvent, index: ListPageQuery['index'], partitionValue: string) {
    const rawCursor = event.queryStringParameters?.cursor;
    const startAfter = rawCursor ? decodeCursor(rawCursor) : undefined;
    const [rows, totalCount] = await Promise.all([
      deps.repo.listPage({ index, partitionValue, limit: PAGE_SIZE, startAfter }),
      deps.repo.count(index, partitionValue),
    ]);
    const items = rows.slice(0, PAGE_SIZE);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > PAGE_SIZE && last?.sortKey
        ? encodeCursor({ reportId: last.reportId, sortKey: last.sortKey })
        : null;
    return json(200, { items: items.map(itemView), nextCursor, totalCount }, requestIdOf(event));
  }

  return {
    'GET /v1/catalog/reports': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'requester');
      return page(event, INDEX_ALL, ALL_PARTITION);
    },
    'GET /v1/catalog/my-reports': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter');
      return page(event, INDEX_HUNTER, caller.accountId);
    },
  };
}
