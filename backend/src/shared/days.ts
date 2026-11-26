// 日数の共通の計算（BR4.9）。24 時間を 1 日として切り捨てる（暦日では数えない）。
// U3 の複数箇所（catalog の「送ってから n 日」）で使うため、ここに切り出す（code-generation-plan Step 11）。

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 開始時刻（ISO 文字列）から今の時刻（ミリ秒）までの経過日数。24 時間未満は 0 */
export function daysElapsedFloor(fromIso: string, nowMs: number): number {
  const elapsedMs = nowMs - new Date(fromIso).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  return Math.floor(elapsedMs / MS_PER_DAY);
}

/** 開始時刻からの経過がちょうど n 日を超えているか（ちょうど n 日では超えていない） */
export function elapsedMoreThanDays(fromIso: string, nowMs: number, days: number): boolean {
  const elapsedMs = nowMs - new Date(fromIso).getTime();
  return elapsedMs > days * MS_PER_DAY;
}
