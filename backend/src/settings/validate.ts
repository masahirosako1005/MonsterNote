// 設定の値の範囲の確認（BR9.2）と初期値（BR9.3）。
import type { ErrorDetail } from '../shared/errors';
import { SETTINGS_KEY, type SettingRecord } from './repository';

/** BR9.3: 初期値（1,000 m・24 時間・日本の範囲。requirements FR2.14） */
export const DEFAULT_SETTINGS: Omit<SettingRecord, 'updatedAt'> = {
  settingKey: SETTINGS_KEY,
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
};

/** BR9.3: 設定の行がないときは初期値を補う */
export function withDefaults(
  record: SettingRecord | undefined,
  now: () => Date = () => new Date(),
): SettingRecord {
  return record ?? { ...DEFAULT_SETTINGS, updatedAt: now().toISOString() };
}

export interface SettingValues {
  duplicateDistanceMeters: number;
  duplicateWindowHours: number;
  targetAreaNorth: number;
  targetAreaSouth: number;
  targetAreaEast: number;
  targetAreaWest: number;
}

/** BR9.2: 距離は 1 m 以上、時間は 1 時間以上、対象地域は北 > 南・東 > 西 */
export function validateSettingValues(input: SettingValues): ErrorDetail[] {
  const details: ErrorDetail[] = [];
  if (!(input.duplicateDistanceMeters >= 1)) {
    details.push({ field: 'duplicateDistanceMeters', reason: 'out-of-range' });
  }
  if (!(input.duplicateWindowHours >= 1)) {
    details.push({ field: 'duplicateWindowHours', reason: 'out-of-range' });
  }
  if (!(input.targetAreaNorth > input.targetAreaSouth)) {
    details.push({ field: 'targetAreaNorth', reason: 'must-exceed-south' });
  }
  if (!(input.targetAreaEast > input.targetAreaWest)) {
    details.push({ field: 'targetAreaEast', reason: 'must-exceed-west' });
  }
  return details;
}

/** BR2.16: 捕獲場所が対象地域（四角い範囲）の中か（境界は含む） */
export function isWithinTargetArea(
  location: { lat: number; lng: number },
  settings: SettingRecord,
): boolean {
  return (
    location.lat >= settings.targetAreaSouth &&
    location.lat <= settings.targetAreaNorth &&
    location.lng >= settings.targetAreaWest &&
    location.lng <= settings.targetAreaEast
  );
}
