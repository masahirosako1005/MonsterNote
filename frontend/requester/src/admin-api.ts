// 管理者の画面が呼ぶAPI（U4。アカウント管理・設定・操作の記録・すべて削除）
import type { ApiClient } from '@ui-kit/api/client';
import type { Role } from '@ui-kit/session/roles';

export interface AccountRow {
  accountId: string;
  loginId: string;
  displayName: string;
  role: Role;
  status: 'active' | 'disabled';
  organization?: string;
}

export function listAccounts(api: ApiClient): Promise<{ items: AccountRow[] }> {
  return api.get('/v1/admin/accounts');
}

export interface CreateAccountInput {
  role: Role;
  loginId: string;
  displayName: string;
  organization?: string;
}

export interface TemporaryPasswordResult {
  accountId: string;
  temporaryPassword: string;
}

export function createAccount(
  api: ApiClient,
  input: CreateAccountInput,
): Promise<TemporaryPasswordResult> {
  return api.post('/v1/admin/accounts', input);
}

export function resetPassword(api: ApiClient, accountId: string): Promise<TemporaryPasswordResult> {
  return api.post(`/v1/admin/accounts/${encodeURIComponent(accountId)}/password-reset`);
}

export function setAccountStatus(
  api: ApiClient,
  accountId: string,
  status: 'active' | 'disabled',
): Promise<void> {
  return api.put(`/v1/admin/accounts/${encodeURIComponent(accountId)}/status`, { status });
}

export interface AdminSettings {
  duplicateDistanceMeters: number;
  duplicateWindowHours: number;
  targetAreaNorth: number;
  targetAreaSouth: number;
  targetAreaEast: number;
  targetAreaWest: number;
  updatedByAccountId?: string;
  updatedAt: string;
}

export function getAdminSettings(api: ApiClient): Promise<AdminSettings> {
  return api.get('/v1/admin/settings');
}

export function updateAdminSettings(
  api: ApiClient,
  input: Omit<AdminSettings, 'updatedByAccountId' | 'updatedAt'>,
): Promise<void> {
  return api.put('/v1/admin/settings', input);
}

export interface AuditEntryRow {
  entryId: string;
  occurredAt: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'succeeded' | 'failed';
  detail?: Record<string, unknown>;
}

export function listAuditEntries(
  api: ApiClient,
  cursor?: string,
): Promise<{ items: AuditEntryRow[]; nextCursor: string | null }> {
  return api.get(`/v1/admin/audit-entries${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
}

/** 試験運用の終わりの削除（BR13.1）の5つの入口。この順で呼ぶ */
export const DELETE_ENDPOINTS = [
  { key: 'catalog', label: '一覧', path: '/v1/admin/catalog-data' },
  { key: 'review', label: '確認の記録', path: '/v1/admin/review-data' },
  { key: 'duplicate', label: '重複の索引と疑い', path: '/v1/admin/duplicate-data' },
  { key: 'detection', label: '判別の結果', path: '/v1/admin/detection-data' },
  { key: 'reporting', label: '報告と写真', path: '/v1/admin/reporting-data' },
] as const;

export function deleteAllAt(api: ApiClient, path: string): Promise<{ deletedCount: number }> {
  return api.post(path);
}
