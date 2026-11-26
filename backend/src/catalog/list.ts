// 一覧（C4 GET /v1/catalog/reports・GET /v1/catalog/my-reports）。
// BR4.2: 依頼元はすべての報告、BR4.3: ハンターは自分の報告。どちらも送信の新しい順に 50 件。
// BR4.4: cursor は前のページの最後の行の（submittedAt、reportId）を表す、画面が中身を読まない文字列。壊れていたら 400。
// U3: BR4.5 の絞り込み（status・flag）、BR4.7・BR4.8（新しい順に読んでから除く。読む上限 2,000 件。D-1）、
// BR4.9 の日数（データには持たず読み出しのたびに計算する。Q4）、D-2 の緯度・経度を足す。
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type HttpEvent, type RouteHandler } from '../shared/http';
import { waitingInfoFor } from './days-elapsed';
import { hasFilter, matchesFilter, parseFilter, type CatalogFilter } from './filter';
import {
  ALL_PARTITION,
  INDEX_ALL,
  INDEX_HUNTER,
  type CatalogRepository,
  type ListPageQuery,
  type ReportListItemRecord,
} from './repository';

export const PAGE_SIZE = 50;
/** 絞り込みのときに 1 回の呼び出しで読む生の行数の上限（BR4.7・BR4.8。無料枠を守る目安） */
export const MAX_ROWS_READ = 2000;
/** 索引を 1 回のクエリで読む生の行数（絞り込みのときはページをまたいで読み進める） */
const RAW_BATCH = 100;

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

function cursorOf(row: ReportListItemRecord): Cursor | undefined {
  return row.sortKey ? { reportId: row.reportId, sortKey: row.sortKey } : undefined;
}

/** 画面に返す一覧の行（索引のキーなど内部の項目は出さない） */
function itemView(row: ReportListItemRecord, nowMs: number) {
  const waiting = waitingInfoFor(row.status, row.submittedAt, nowMs);
  return {
    reportId: row.reportId,
    hunterName: row.hunterName,
    species: row.species,
    capturedAt: row.capturedAt,
    placeName: row.placeName ?? null,
    // D-2: placeName が空のあいだ、緯度・経度を一覧に出す
    ...(!row.placeName && row.location ? { location: row.location } : {}),
    status: row.status,
    duplicateSuspected: row.duplicateSuspected,
    manualEntry: row.manualEntry,
    submittedAt: row.submittedAt,
    // BR4.9: 確認中の行だけ（データには持たず、読み出しのたびに計算する）
    ...(waiting ?? {}),
  };
}

interface ScanOutcome {
  matched: ReportListItemRecord[];
  /** 索引の終わりまで読み切ったか（true なら matched がその対象の全件） */
  exhausted: boolean;
  /** 打ち切ったときに、続きから読める位置（exhausted なら無し） */
  cursor?: Cursor;
}

/**
 * 新しい順に読み進め、filter に合う行を集める（BR4.7）。
 * - stopWhenMatchedExceeds が指定されていれば、合う行がその数を超えたら打ち切る（ページ用）
 * - 読んだ生の行数が MAX_ROWS_READ に達したら打ち切る（BR4.8）
 * - 1 回のページ読み出しが失敗したら、そこまでの結果で打ち切る（performance-design.md §2 Q2-A）
 */
async function scan(
  repo: CatalogRepository,
  index: ListPageQuery['index'],
  partitionValue: string,
  filter: CatalogFilter,
  startAfter: Cursor | undefined,
  stopWhenMatchedExceeds: number | undefined,
): Promise<ScanOutcome> {
  const matched: ReportListItemRecord[] = [];
  let cursor = startAfter;
  let read = 0;

  while (read < MAX_ROWS_READ) {
    const batchLimit = Math.min(RAW_BATCH, MAX_ROWS_READ - read);
    let raw: ReportListItemRecord[];
    try {
      raw = await repo.listPage({ index, partitionValue, limit: batchLimit, startAfter: cursor });
    } catch {
      // Q2-A: 読み出し中の一時的な失敗（SDK のやり直しも尽きた）は、そこまでの結果で打ち切る
      return { matched, exhausted: false, cursor };
    }
    const pageRows = raw.slice(0, batchLimit);
    if (pageRows.length === 0) return { matched, exhausted: true, cursor: undefined };
    read += pageRows.length;
    for (const row of pageRows) {
      if (matchesFilter(row, filter)) matched.push(row);
    }
    const hasMoreRaw = raw.length > batchLimit;
    const last = cursorOf(pageRows[pageRows.length - 1]!);
    if (!hasMoreRaw || !last) return { matched, exhausted: true, cursor: undefined };
    cursor = last;
    if (stopWhenMatchedExceeds !== undefined && matched.length > stopWhenMatchedExceeds) {
      return { matched, exhausted: false, cursor };
    }
  }
  return { matched, exhausted: false, cursor };
}

export function createListRoutes(deps: {
  repo: CatalogRepository;
  now?: () => Date;
}): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());

  async function page(event: HttpEvent, index: ListPageQuery['index'], partitionValue: string) {
    const nowMs = now().getTime();
    const rawCursor = event.queryStringParameters?.cursor;
    const startAfter = rawCursor ? decodeCursor(rawCursor) : undefined;
    const filter = parseFilter(event.queryStringParameters);

    if (!hasFilter(filter)) {
      // 絞り込みなし（U1 のまま。1 回のクエリ + 索引全体の COUNT）
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
      return json(
        200,
        { items: items.map((r) => itemView(r, nowMs)), nextCursor, totalCount },
        requestIdOf(event),
      );
    }

    // BR4.5・BR4.7・BR4.8: 絞り込みあり
    const [pageScan, totalScan] = await Promise.all([
      scan(deps.repo, index, partitionValue, filter, startAfter, PAGE_SIZE),
      scan(deps.repo, index, partitionValue, filter, undefined, undefined),
    ]);
    const items = pageScan.matched.slice(0, PAGE_SIZE);
    const hasNext = pageScan.matched.length > PAGE_SIZE;
    let nextCursor: string | null = null;
    if (hasNext) {
      const c = cursorOf(items[items.length - 1]!);
      if (c) nextCursor = encodeCursor(c);
    } else if (!pageScan.exhausted && pageScan.cursor) {
      // ちょうど limit 件以下しか集まらなかったが、まだ続きがある（上限に達した・一時的な失敗で打ち切った）
      nextCursor = encodeCursor(pageScan.cursor);
    }
    const body: Record<string, unknown> = {
      items: items.map((r) => itemView(r, nowMs)),
      nextCursor,
      totalCount: totalScan.matched.length,
    };
    // D-1: 読む上限に達した（または一時的な失敗で打ち切った）ときは「これ以上ある」の印
    if (!totalScan.exhausted) body.totalCountHasMore = true;
    return json(200, body, requestIdOf(event));
  }

  return {
    'GET /v1/catalog/reports': async (event) => {
      const caller = getCaller(event);
      // U4（D-8）: 「すべて削除」の確認画面（BR13.2）が件数を見せるため、管理者にも開く
      requireRole(caller, 'requester', 'admin');
      return page(event, INDEX_ALL, ALL_PARTITION);
    },
    'GET /v1/catalog/my-reports': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter');
      return page(event, INDEX_HUNTER, caller.accountId);
    },
  };
}
