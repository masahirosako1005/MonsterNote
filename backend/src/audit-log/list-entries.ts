// GET /v1/admin/audit-entries（BR12.1・BR12.3・AC6.6.3）。新しい順・50件・次のページ。
// 利用者のIDは出さず、actorNameだけを返す。
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { AuditLogRepository, Cursor } from './repository';

const PAGE_SIZE = 50;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    if (typeof parsed.entryId !== 'string' || typeof parsed.sortKey !== 'string') throw new Error();
    return parsed;
  } catch {
    throw errors.validation([{ field: 'cursor', reason: 'invalid' }]);
  }
}

export interface ListEntriesDeps {
  repo: AuditLogRepository;
}

export function createListEntriesRoute(deps: ListEntriesDeps): RouteHandler {
  return async (event) => {
    requireRole(getCaller(event), 'admin'); // 管理者だけ（BR12.1。U4）
    const rawCursor = event.queryStringParameters?.cursor;
    const startAfter = rawCursor ? decodeCursor(rawCursor) : undefined;
    const page = await deps.repo.listPage({ limit: PAGE_SIZE, startAfter });
    return json(
      200,
      {
        items: page.items.map((e) => ({
          entryId: e.entryId,
          occurredAt: e.occurredAt,
          actorName: e.actorName,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          outcome: e.outcome,
          detail: e.detail,
        })),
        nextCursor: page.cursor ? encodeCursor(page.cursor) : null,
      },
      requestIdOf(event),
    );
  };
}
