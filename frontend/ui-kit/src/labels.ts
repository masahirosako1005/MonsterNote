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
