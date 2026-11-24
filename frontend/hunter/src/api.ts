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

/** BR6.1・BR6.4: 全身の写真の判別の結果（完了の応答に含まれる。全身以外は結果なし） */
export interface DetectionResultView {
  outcome: 'detected' | 'undetected';
  species?: Species;
  confidence?: number;
}

export type PhotoKind = 'body' | 'tail' | 'chest';

/** 写真の受け付け → S3 へ署名付きの POST → 完了の知らせ（UC8）。全身の写真なら判別の結果も返る */
export async function uploadPhoto(
  api: ApiClient,
  photo: Blob,
  kind: PhotoKind = 'body',
): Promise<{ photoId: string; detection?: DetectionResultView }> {
  const contentType = photo.type || 'image/jpeg';
  const ticket = await api.post<PhotoTicket>('/v1/photos', {
    kind,
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
  const completed = await api.post<{ photoId: string; detection?: DetectionResultView }>(
    `/v1/photos/${encodeURIComponent(ticket.photoId)}/complete`,
  );
  return { photoId: ticket.photoId, detection: completed.detection };
}

/** U1 からの呼び出し元に向けた薄い別名（全身の写真専用） */
export async function uploadBodyPhoto(
  api: ApiClient,
  photo: Blob,
): Promise<{ photoId: string; detection?: DetectionResultView }> {
  return uploadPhoto(api, photo, 'body');
}

export interface DuplicateMatchView {
  species: string;
  capturedAt: string;
  distanceMeters: number;
}

export interface SubmitInput {
  submissionKey: string;
  photoId: string;
  species: Species;
  sex: Sex;
  location: GeoPoint;
  /** 送信前の重複の知らせで「別の個体なので送る」を選んだあとの送り直し（BR7.2） */
  confirmedNotDuplicate?: boolean;
}

/** 409 DUPLICATE_SUSPECTED: 保存せず、相手の一覧を添えて拒まれた（BR7.1） */
export class DuplicateSuspectedError extends Error {
  constructor(readonly matches: DuplicateMatchView[]) {
    super('近くで同じ種類の報告があります');
    this.name = 'DuplicateSuspectedError';
  }
}

/**
 * 報告の送信。処理中（409 SUBMISSION_IN_PROGRESS）なら 2 秒待って同じキーで送り直す（contract-summary 2.3）。
 * 重複の疑い（409 DUPLICATE_SUSPECTED）はやり直さず、DuplicateSuspectedError として呼び出し側に返す（BR7.1）。
 */
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
    confirmedNotDuplicate: input.confirmedNotDuplicate === true,
  };
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await api.post<{ reportId: string }>('/v1/reports', body);
      return res.reportId;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_SUSPECTED') {
        throw new DuplicateSuspectedError((err.conflict?.matches as DuplicateMatchView[]) ?? []);
      }
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

export interface TargetArea {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** GET /v1/report-settings（U2・新規。ADR-010）: 報告の作成に使う対象地域 */
export async function getReportSettings(api: ApiClient): Promise<TargetArea> {
  const res = await api.get<{ targetArea: TargetArea }>('/v1/report-settings');
  return res.targetArea;
}
