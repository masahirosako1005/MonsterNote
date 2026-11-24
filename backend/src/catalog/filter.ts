// 一覧の絞り込みの値の確認と判定（BR4.5）。知らない値は拒む。
// status（checking・approved・rejected）と flag（duplicate・manual）はそれぞれ複数選べる（カンマ区切り）。
// 同じ種類どうしは「いずれか」、違う種類どうしは「両方」。
import { errors } from '../shared/errors';
import type { ReportListItemRecord } from './repository';

export const FILTER_STATUSES = ['checking', 'approved', 'rejected'] as const;
export type FilterStatus = (typeof FILTER_STATUSES)[number];

export const FILTER_FLAGS = ['duplicate', 'manual'] as const;
export type FilterFlag = (typeof FILTER_FLAGS)[number];

export interface CatalogFilter {
  status?: FilterStatus[];
  flag?: FilterFlag[];
}

function parseList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  field: string,
): T[] | undefined {
  if (raw === undefined || raw.length === 0) return undefined;
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (values.length === 0) return undefined;
  for (const v of values) {
    if (!(allowed as readonly string[]).includes(v)) {
      throw errors.validation([{ field, reason: 'invalid' }]);
    }
  }
  return values as T[];
}

export function parseFilter(
  query: Record<string, string | undefined> | undefined | null,
): CatalogFilter {
  return {
    status: parseList(query?.status, FILTER_STATUSES, 'status'),
    flag: parseList(query?.flag, FILTER_FLAGS, 'flag'),
  };
}

export function hasFilter(filter: CatalogFilter): boolean {
  return Boolean(filter.status?.length) || Boolean(filter.flag?.length);
}

export function matchesFilter(row: ReportListItemRecord, filter: CatalogFilter): boolean {
  if (filter.status?.length && !filter.status.includes(row.status)) return false;
  if (filter.flag?.length) {
    const matchesAny = filter.flag.some((f) =>
      f === 'duplicate' ? row.duplicateSuspected : row.manualEntry,
    );
    if (!matchesAny) return false;
  }
  return true;
}
