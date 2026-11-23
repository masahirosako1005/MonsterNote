// ハンターの画面が呼ぶ API（C2・C4）
import { ApiError, NETWORK_ERROR_MESSAGE, type ApiClient } from '@ui-kit/api/client';
import type { GeoPoint } from '@ui-kit/components/LocationGate';
import type { ReportListRow } from '@ui-kit/components/ReportList';
import type { Sex, Species } from '@ui-kit/labels';

interface PhotoTicket {
  photoId: string;
  uploadUrl: string;
  uploadFields: Record<string, string>;
}

/** 写真の受け付け → S3 へ署名付きの POST → 完了の知らせ（UC2 の 2） */
export async function uploadBodyPhoto(api: ApiClient, photo: Blob): Promise<string> {
  const contentType = photo.type || 'image/jpeg';
  const ticket = await api.post<PhotoTicket>('/v1/photos', {
    kind: 'body',
    contentType,
    sizeBytes: photo.size,
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.uploadFields)) form.append(key, value);
  form.append('file', photo);
  let res: Response;
  try {
    res = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new ApiError(0, 'NETWORK', NETWORK_ERROR_MESSAGE);
  }
  if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', '写真を送れませんでした');
  await api.post(`/v1/photos/${encodeURIComponent(ticket.photoId)}/complete`);
  return ticket.photoId;
}

export interface SubmitInput {
  submissionKey: string;
  photoId: string;
  species: Species;
  sex: Sex;
  location: GeoPoint;
}

/** 報告の送信。処理中（409 SUBMISSION_IN_PROGRESS）なら 2 秒待って同じキーで送り直す（contract-summary 2.3） */
export async function submitReport(
  api: ApiClient,
  input: SubmitInput,
  sleep: (ms: number) => Promise<void>,
  maxInProgressRetries = 3,
): Promise<string> {
  const body = {
    submissionKey: input.submissionKey,
    photos: { body: input.photoId },
    location: input.location,
    species: input.species,
    sex: input.sex,
  };
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await api.post<{ reportId: string }>('/v1/reports', body);
      return res.reportId;
    } catch (err) {
      const inProgress = err instanceof ApiError && err.code === 'SUBMISSION_IN_PROGRESS';
      if (!inProgress || attempt >= maxInProgressRetries) throw err;
      const seconds = Number(err.conflict?.retryAfterSeconds ?? 2);
      await sleep(seconds * 1000);
    }
  }
}

export interface ListPage {
  items: ReportListRow[];
  nextCursor: string | null;
  totalCount: number;
}

export function listMyReports(api: ApiClient, cursor?: string): Promise<ListPage> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api.get<ListPage>(`/v1/catalog/my-reports${q}`);
}
