// 重複の判定の共通ロジック（BR8.1〜BR8.3）。送信前の問い合わせ・保存後の再判定の両方で使う（Step 11 の共有部分）。
import type { Species } from '../species-detection/repository';
import type { SettingRecord } from '../settings/repository';
import type { DuplicateRepository, ReportFootprintRecord } from './repository';

const EARTH_RADIUS_METERS = 6_371_000;
const MS_PER_HOUR = 60 * 60 * 1000;
/** performance-design §3: 1 ページ（1 日）あたり読む件数 */
const QUERY_PAGE_LIMIT = 100;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MatchTarget {
  species: Species;
  capturedAt: string;
  location: GeoPoint;
  /** 保存後の再判定のときだけ渡す。自分自身を候補から除く */
  excludeReportId?: string;
}

export interface MatchCandidate {
  footprint: ReportFootprintRecord;
  distanceMeters: number;
  hoursApart: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** BR8.2: 地球を球（半径 6,371 km）とみなした大円距離（ハバーサイン） */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * BR8.3: 捕獲日の前後、何日分を読むか（片側）。基準の時間が 24 時間以内なら 1 日（前後あわせて 3 日分）、
 * それを超える設定では必要な日数に広げる（assumption）。
 */
export function halfRangeDays(windowHours: number): number {
  return Math.max(1, Math.ceil(windowHours / 24));
}

/** 読む speciesDay のキーの一覧（種類#UTC日付） */
export function speciesDayKeysAround(
  species: Species,
  capturedAt: string,
  windowHours: number,
): string[] {
  const half = halfRangeDays(windowHours);
  const base = new Date(capturedAt);
  const keys: string[] = [];
  for (let offset = -half; offset <= half; offset++) {
    const d = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offset),
    );
    keys.push(speciesDayKeyOf(species, d.toISOString()));
  }
  return keys;
}

/** ReportFootprint.speciesDay に書く値（種類#捕獲日の UTC 日付） */
export function speciesDayKeyOf(species: Species, capturedAt: string): string {
  return `${species}#${new Date(capturedAt).toISOString().slice(0, 10)}`;
}

/** BR8.1: 同じ種類・距離が基準以内・捕獲日時の差が基準以内（境界は含む） */
function matchAgainst(
  target: MatchTarget,
  candidate: ReportFootprintRecord,
  settings: SettingRecord,
): { distanceMeters: number; hoursApart: number } | undefined {
  if (!candidate.species || !candidate.location || !candidate.capturedAt) return undefined;
  if (candidate.species !== target.species) return undefined;
  const distanceMeters = haversineMeters(target.location, candidate.location);
  if (distanceMeters > settings.duplicateDistanceMeters) return undefined;
  const hoursApart =
    Math.abs(new Date(target.capturedAt).getTime() - new Date(candidate.capturedAt).getTime()) /
    MS_PER_HOUR;
  if (hoursApart > settings.duplicateWindowHours) return undefined;
  return { distanceMeters, hoursApart };
}

/**
 * 前後 3 日分（基準により広がる）の索引から、active かつ savedReceived の相手を読んで基準に当てる
 * （BR8.1〜BR8.3、BR8.7: active=false の相手は候補にしない）。
 */
export async function findMatches(
  repo: DuplicateRepository,
  target: MatchTarget,
  settings: SettingRecord,
): Promise<MatchCandidate[]> {
  const keys = speciesDayKeysAround(
    target.species,
    target.capturedAt,
    settings.duplicateWindowHours,
  );
  const matches: MatchCandidate[] = [];
  const seenReportIds = new Set<string>();
  for (const key of keys) {
    const page = await repo.queryBySpeciesDay(key, QUERY_PAGE_LIMIT);
    for (const candidate of page) {
      if (!candidate.active || !candidate.savedReceived) continue;
      if (target.excludeReportId && candidate.reportId === target.excludeReportId) continue;
      if (seenReportIds.has(candidate.reportId)) continue;
      const hit = matchAgainst(target, candidate, settings);
      if (hit) {
        seenReportIds.add(candidate.reportId);
        matches.push({ footprint: candidate, ...hit });
      }
    }
  }
  return matches;
}

/** BR8.6: 2 件の報告と種類から決める suspicionId。先頭はこの行の持ち主（reportId） */
export function suspicionIdOf(reportId: string, matchedReportId: string, kind: string): string {
  return `${reportId}#${matchedReportId}#${kind}`;
}
