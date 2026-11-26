// 画面に出す日本語の名前（値は約束の英語のまま持つ）
export type Species = 'bear' | 'boar' | 'deer';
export type Sex = 'male' | 'female' | 'unknown';
export type ReportStatus = 'checking' | 'approved' | 'rejected';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export const SPECIES_OPTIONS: ChoiceOption<Species>[] = [
  { value: 'bear', label: 'クマ' },
  { value: 'boar', label: 'イノシシ' },
  { value: 'deer', label: 'シカ' },
];

export const SEX_OPTIONS: ChoiceOption<Sex>[] = [
  { value: 'male', label: 'オス' },
  { value: 'female', label: 'メス' },
  { value: 'unknown', label: '不明' },
];

// U2（新規。Build and Testで発見: バックエンドは必須だが画面で一度も集めていなかった）
export type AgeClass = 'adult' | 'juvenile';
export type CaptureMethod = 'trap' | 'gun' | 'other';

export const AGE_CLASS_OPTIONS: ChoiceOption<AgeClass>[] = [
  { value: 'adult', label: '成獣' },
  { value: 'juvenile', label: '幼獣' },
];

export const CAPTURE_METHOD_OPTIONS: ChoiceOption<CaptureMethod>[] = [
  { value: 'trap', label: 'わな' },
  { value: 'gun', label: '銃' },
  { value: 'other', label: 'その他' },
];

export const STATUS_LABELS: Record<ReportStatus, string> = {
  checking: '確認中',
  approved: '承認',
  rejected: '却下',
};

// U3: 却下の理由（BR3.8）
export type RejectReason = 'duplicate' | 'insufficient-photo' | 'out-of-scope' | 'other';
export const REJECT_REASON_OPTIONS: ChoiceOption<RejectReason>[] = [
  { value: 'duplicate', label: '重複の疑い' },
  { value: 'insufficient-photo', label: '写真が不十分' },
  { value: 'out-of-scope', label: '対象の地域・種類ではない' },
  { value: 'other', label: 'その他' },
];
export function rejectReasonLabel(value: string | undefined): string {
  return REJECT_REASON_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

// U3: 一覧の絞り込み（BR4.5）
export const FILTER_STATUS_OPTIONS: ChoiceOption<ReportStatus>[] = [
  { value: 'checking', label: '確認中' },
  { value: 'approved', label: '承認' },
  { value: 'rejected', label: '却下' },
];
export type FilterFlag = 'duplicate' | 'manual';
export const FILTER_FLAG_OPTIONS: ChoiceOption<FilterFlag>[] = [
  { value: 'duplicate', label: '重複の疑い' },
  { value: 'manual', label: '手入力' },
];

export function speciesLabel(value: string | undefined): string {
  return SPECIES_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

export function sexLabel(value: string | undefined): string {
  return SEX_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

export function ageClassLabel(value: string | undefined): string {
  return AGE_CLASS_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

export function captureMethodLabel(value: string | undefined): string {
  return CAPTURE_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/** 日本の時刻で「2026/11/23」 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** 日本の時刻で「2026/11/23 12:00」 */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// U4: アカウントの役割・状態、操作の記録の種類
export type AccountRole = 'hunter' | 'requester' | 'admin';
export const ACCOUNT_ROLE_OPTIONS: ChoiceOption<AccountRole>[] = [
  { value: 'hunter', label: 'ハンター' },
  { value: 'requester', label: '依頼元' },
  { value: 'admin', label: '管理者' },
];
export function accountRoleLabel(value: string | undefined): string {
  return ACCOUNT_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

export const ACCOUNT_STATUS_LABELS: Record<'active' | 'disabled', string> = {
  active: '有効',
  disabled: '無効',
};

export type Organization = 'municipality' | 'hunters-association';
export const ORGANIZATION_OPTIONS: ChoiceOption<Organization>[] = [
  { value: 'municipality', label: '市区町村' },
  { value: 'hunters-association', label: '猟友会' },
];

/** U4（frontend-components.mdのAssumptions）: 操作の種類の英語の値 → 日本語の言い回し */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'report.submitted': '報告の送信',
  'review.approved': '承認',
  'review.rejected': '却下',
  'review.undone': '取り消し',
  'duplicate.suspected': '重複の疑い',
  'account.created': 'アカウントの作成',
  'account.password-reset': 'パスワードの再設定',
  'account.disabled': 'アカウントの無効化',
  'account.enabled': 'アカウントの有効化',
  'settings.updated': '設定の変更',
  'data.deleted': 'データの削除',
};
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
