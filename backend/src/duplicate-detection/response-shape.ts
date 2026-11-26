// 重複の知らせに出してよい項目だけに絞り込む（NFR5.7・BR7.3）。
// 相手の reportId・hunterAccountId はここで落とし、元のデータを持つオブジェクトをそのまま返さない。
import type { Species } from '../species-detection/repository';
import type { MatchCandidate } from './match';

export const DISTANCE_ROUNDING_METERS = 100;

/** 画面・応答に出してよい形（氏名・写真・reportId は持たない） */
export interface TrimmedMatch {
  species: Species;
  capturedAt: string;
  distanceMeters: number;
}

/** 距離を 100 m 単位に丸める（細かい距離から場所が推測されないように。rules.md の assumption） */
export function roundDistanceMeters(distanceMeters: number): number {
  return Math.round(distanceMeters / DISTANCE_ROUNDING_METERS) * DISTANCE_ROUNDING_METERS;
}

/** 候補 1 件を、許された 3 つの項目だけを持つ型に変換する */
export function trimMatch(match: MatchCandidate): TrimmedMatch {
  return {
    species: match.footprint.species as Species,
    capturedAt: match.footprint.capturedAt as string,
    distanceMeters: roundDistanceMeters(match.distanceMeters),
  };
}

export function trimMatches(matches: MatchCandidate[]): TrimmedMatch[] {
  return matches.map(trimMatch);
}
