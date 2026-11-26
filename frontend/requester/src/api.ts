// 依頼元の画面が呼ぶ API（C2・C3・C4）
import { ApiError, type ApiClient } from '@ui-kit/api/client';
import type { ReportDetailData } from '@ui-kit/components/ReportDetail';
import type { ReportListRow } from '@ui-kit/components/ReportList';
import type { RejectReason, ReportStatus } from '@ui-kit/labels';

export interface ListPage {
  items: ReportListRow[];
  nextCursor: string | null;
  totalCount: number;
  totalCountHasMore?: boolean;
}

export interface ReviewView {
  reportId: string;
  status: ReportStatus;
  decidedByName?: string;
  decidedAt?: string;
  reason?: RejectReason;
  reasonText?: string;
  /** 本人かつ期限内のときだけ返る（BR3.15） */
  undoUntil?: string;
}

export interface CatalogFilter {
  status?: ReportStatus[];
  flag?: ('duplicate' | 'manual')[];
}

function queryOf(cursor?: string, filter?: CatalogFilter): string {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (filter?.status?.length) params.set('status', filter.status.join(','));
  if (filter?.flag?.length) params.set('flag', filter.flag.join(','));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function listReports(
  api: ApiClient,
  cursor?: string,
  filter?: CatalogFilter,
): Promise<ListPage> {
  return api.get<ListPage>(`/v1/catalog/reports${queryOf(cursor, filter)}`);
}

export function getReport(api: ApiClient, reportId: string): Promise<ReportDetailData> {
  return api.get<ReportDetailData>(`/v1/reports/${encodeURIComponent(reportId)}`);
}

/** 状態を読む。確認の記録がまだない（404 REVIEW_NOT_READY）なら「確認中」として扱う（BR3.7） */
export async function getReview(api: ApiClient, reportId: string): Promise<ReviewView> {
  try {
    return await api.get<ReviewView>(`/v1/reviews/${encodeURIComponent(reportId)}`);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'REVIEW_NOT_READY')
      return { reportId, status: 'checking' };
    throw err;
  }
}

export async function approve(api: ApiClient, reportId: string): Promise<void> {
  await api.put(`/v1/reviews/${encodeURIComponent(reportId)}/decision`, { decision: 'approved' });
}

/** C5 GET /v1/duplicates/{reportId}: 重複の疑いの相手の一覧（BR8.9）。氏名・写真は含まない */
export interface DuplicateMatchView {
  matchedReportId: string;
  kind: string;
  distanceMeters?: number;
  hoursApart?: number;
  matchedStatus: ReportStatus;
}

export function listDuplicates(
  api: ApiClient,
  reportId: string,
): Promise<{ reportId: string; matches: DuplicateMatchView[] }> {
  return api.get(`/v1/duplicates/${encodeURIComponent(reportId)}`);
}

/** 却下（BR3.8）。理由は画面側ですでに確かめているが、サーバーでも確かめる */
export async function reject(
  api: ApiClient,
  reportId: string,
  input: { reason: RejectReason; reasonText?: string },
): Promise<void> {
  await api.put(`/v1/reviews/${encodeURIComponent(reportId)}/decision`, {
    decision: 'rejected',
    ...input,
  });
}

/**
 * 取り消し（BR3.9）。すでに確認中に戻っている（ALREADY_UNDONE）・期限切れ（UNDO_EXPIRED）は
 * 画面のエラーにせず、呼び出し側が状態を出し直す前提で吸収する（D-6・NFR7.7）
 */
export async function undoDecision(api: ApiClient, reportId: string): Promise<void> {
  try {
    await api.post(`/v1/reviews/${encodeURIComponent(reportId)}/decision/undo`);
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'ALREADY_UNDONE' || err.code === 'UNDO_EXPIRED')) {
      return;
    }
    throw err;
  }
}
