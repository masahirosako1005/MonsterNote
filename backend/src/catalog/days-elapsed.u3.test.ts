// 「送ってから n 日」「7 日以上」の計算（BR4.9）。24 時間を 1 日として切り捨て。ちょうど 7 日では付かない。
import { describe, expect, it } from 'vitest';
import { waitingInfoFor } from './days-elapsed';

const SUBMITTED = '2026-11-16T04:00:00.000Z';

describe('waitingInfoFor', () => {
  it('確認済み（approved・rejected）には出さない（BR4.9）', () => {
    expect(waitingInfoFor('approved', SUBMITTED, Date.now())).toBeUndefined();
    expect(waitingInfoFor('rejected', SUBMITTED, Date.now())).toBeUndefined();
  });

  it('submittedAt が無ければ出さない', () => {
    expect(waitingInfoFor('checking', undefined, Date.now())).toBeUndefined();
  });

  it('3 日 5 時間なら「3 日」（24 時間を 1 日として切り捨て）', () => {
    const now = new Date(SUBMITTED).getTime() + (3 * 24 + 5) * 60 * 60 * 1000;
    expect(waitingInfoFor('checking', SUBMITTED, now)?.daysSinceSubmitted).toBe(3);
  });

  it('ちょうど 7 日では「7 日以上」を付けない（AC4.7.2）', () => {
    const now = new Date(SUBMITTED).getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(waitingInfoFor('checking', SUBMITTED, now)?.waitingOverSevenDays).toBe(false);
  });

  it('7 日 1 時間では「7 日以上」を付ける（AC4.7.1）', () => {
    const now = new Date(SUBMITTED).getTime() + (7 * 24 + 1) * 60 * 60 * 1000;
    expect(waitingInfoFor('checking', SUBMITTED, now)?.waitingOverSevenDays).toBe(true);
  });

  it('6 日では付けない', () => {
    const now = new Date(SUBMITTED).getTime() + 6 * 24 * 60 * 60 * 1000;
    expect(waitingInfoFor('checking', SUBMITTED, now)?.waitingOverSevenDays).toBe(false);
  });
});
