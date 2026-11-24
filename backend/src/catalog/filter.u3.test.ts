// 一覧の絞り込みの値の確認と判定（BR4.5）
import { describe, expect, it } from 'vitest';
import { hasFilter, matchesFilter, parseFilter } from './filter';
import type { ReportListItemRecord } from './repository';

function row(partial: Partial<ReportListItemRecord> = {}): ReportListItemRecord {
  return {
    reportId: 'report-1',
    status: 'checking',
    duplicateSuspected: false,
    manualEntry: false,
    savedReceived: true,
    ...partial,
  };
}

describe('parseFilter', () => {
  it('status・flag が無ければ空（絞り込みなし）', () => {
    expect(hasFilter(parseFilter({}))).toBe(false);
    expect(hasFilter(parseFilter(undefined))).toBe(false);
  });

  it('カンマ区切りの複数の値を受け付ける', () => {
    expect(parseFilter({ status: 'checking,approved' })).toEqual({
      status: ['checking', 'approved'],
      flag: undefined,
    });
    expect(parseFilter({ flag: 'duplicate,manual' }).flag).toEqual(['duplicate', 'manual']);
  });

  it('知らない値は 400 相当の例外', () => {
    expect(() => parseFilter({ status: 'pending' })).toThrow();
    expect(() => parseFilter({ flag: 'spam' })).toThrow();
  });
});

describe('matchesFilter', () => {
  it('status を指定すると、そのどれかに当たる行だけ true', () => {
    const filter = parseFilter({ status: 'approved,rejected' });
    expect(matchesFilter(row({ status: 'approved' }), filter)).toBe(true);
    expect(matchesFilter(row({ status: 'checking' }), filter)).toBe(false);
  });

  it('flag=duplicate は duplicateSuspected、flag=manual は manualEntry を見る', () => {
    const dup = parseFilter({ flag: 'duplicate' });
    expect(matchesFilter(row({ duplicateSuspected: true }), dup)).toBe(true);
    expect(matchesFilter(row({ duplicateSuspected: false }), dup)).toBe(false);

    const manual = parseFilter({ flag: 'manual' });
    expect(matchesFilter(row({ manualEntry: true }), manual)).toBe(true);
  });

  it('status と flag の両方を指定すると、両方を満たす行だけ true（AC4.1.2）', () => {
    const filter = parseFilter({ status: 'checking', flag: 'duplicate' });
    expect(matchesFilter(row({ status: 'checking', duplicateSuspected: true }), filter)).toBe(true);
    expect(matchesFilter(row({ status: 'checking', duplicateSuspected: false }), filter)).toBe(
      false,
    );
    expect(matchesFilter(row({ status: 'approved', duplicateSuspected: true }), filter)).toBe(
      false,
    );
  });

  it('同じ種類の複数の flag は「いずれか」', () => {
    const filter = parseFilter({ flag: 'duplicate,manual' });
    expect(matchesFilter(row({ duplicateSuspected: true, manualEntry: false }), filter)).toBe(true);
    expect(matchesFilter(row({ duplicateSuspected: false, manualEntry: true }), filter)).toBe(true);
    expect(matchesFilter(row({ duplicateSuspected: false, manualEntry: false }), filter)).toBe(
      false,
    );
  });

  it('絞り込みが空なら常に true', () => {
    expect(matchesFilter(row(), {})).toBe(true);
  });
});
