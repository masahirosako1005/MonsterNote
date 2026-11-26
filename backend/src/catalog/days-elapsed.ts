// 「送ってから n 日」と「7 日以上」の印（BR4.9）。データには持たず、一覧を読むたびに submittedAt と
// 今の時刻から計算する（Q4）。確認済み（承認・却下）の報告には出さない。
import { daysElapsedFloor, elapsedMoreThanDays } from '../shared/days';

export interface WaitingInfo {
  daysSinceSubmitted: number;
  waitingOverSevenDays: boolean;
}

export function waitingInfoFor(
  status: 'checking' | 'approved' | 'rejected',
  submittedAt: string | undefined,
  nowMs: number,
): WaitingInfo | undefined {
  // 確認済みには出さない（BR4.9）
  if (status !== 'checking' || !submittedAt) return undefined;
  return {
    daysSinceSubmitted: daysElapsedFloor(submittedAt, nowMs),
    waitingOverSevenDays: elapsedMoreThanDays(submittedAt, nowMs, 7),
  };
}
