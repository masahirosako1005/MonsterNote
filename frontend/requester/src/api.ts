// 依頼元の画面が呼ぶ API（C2・C3・C4）
import { ApiError, type ApiClient } from '@ui-kit/api/client';
import type { ReportDetailData } from '@ui-kit/components/ReportDetail';
import type { ReportListRow } from '@ui-kit/components/ReportList';
import type { ReportStatus } from '@ui-kit/labels';

export interface ListPage {
  items: ReportListRow[];
  nextCursor: string | null;
  totalCount: number;
}

export interface ReviewView {
  reportId: string;
  status: ReportStatus;
  decidedByName?: string;
  decidedAt?: string;
}

export function listReports(api: ApiClient, cursor?: string): Promise<ListPage> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api.get<ListPage>(`/v1/catalog/reports${q}`);
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
