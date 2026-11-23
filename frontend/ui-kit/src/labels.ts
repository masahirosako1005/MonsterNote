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
