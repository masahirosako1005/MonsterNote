// 送信の前の重複の問い合わせ（C9 POST /internal/v1/duplicate-checks。BR7.1・BR7.3・BR8.1〜BR8.3・BR8.5）。
// まだ reportId がないため、答えを返すだけで記録は作らず、知らせも送らない（BR8.5）。
import { requireRole, type Caller } from '../shared/auth';
import type { Species } from '../species-detection/repository';
import type { SettingRecord } from '../settings/repository';
import type { InternalAuth } from '../shared/internal-invoke';
import { findMatches, type GeoPoint } from './match';
import { trimMatches, type TrimmedMatch } from './response-shape';
import type { DuplicateRepository } from './repository';

export interface DuplicateCheckRequest {
  kind: 'duplicate-check';
  auth: InternalAuth;
  species: Species;
  capturedAt: string;
  location: GeoPoint;
}

export function isDuplicateCheckRequest(event: unknown): event is DuplicateCheckRequest {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { kind?: unknown }).kind === 'duplicate-check'
  );
}

export interface DuplicateCheckResult {
  suspected: boolean;
  matches: TrimmedMatch[];
}

/** ADR-011 ①: 転送された利用者の証明で、ハンターであることを確かめる */
export function requireHunterCaller(caller: Caller): void {
  requireRole(caller, 'hunter');
}

/** BR7.1・BR8.1〜BR8.3・BR8.5: 送信前は記録を作らない。見つかった相手だけを返す */
export async function checkDuplicate(
  repo: DuplicateRepository,
  settings: SettingRecord,
  input: { species: Species; capturedAt: string; location: GeoPoint },
): Promise<DuplicateCheckResult> {
  const matches = await findMatches(
    repo,
    { species: input.species, capturedAt: input.capturedAt, location: input.location },
    settings,
  );
  return { suspected: matches.length > 0, matches: trimMatches(matches) };
}
