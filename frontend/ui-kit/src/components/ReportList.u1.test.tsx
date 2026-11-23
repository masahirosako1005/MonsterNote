// ReportList の試験（BR4.2・BR4.3、AC4.1.3・AC4.1.4・AC5.1.1・AC5.1.4: 50 件・次のページ・0 件・状態は文字とアイコン）
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportList, type ReportListRow } from './ReportList';

const row = (i: number, status: ReportListRow['status'] = 'checking'): ReportListRow => ({
  reportId: `r-${i}`,
  hunterName: `ハンター ${i}`,
  species: 'boar',
  capturedAt: '2026-11-23T03:00:00.000Z',
  submittedAt: '2026-11-23T03:00:00.000Z',
  status,
});

describe('ReportList', () => {
  it('行ごとに日付・種類・状態（文字とアイコン）を出す', () => {
    render(<ReportList rows={[row(1), row(2, 'approved')]} emptyText="なし" />);
    const items = screen.getAllByTestId('report-row');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('イノシシ')).toBeInTheDocument();
    expect(within(items[0]!).getByText('2026/11/23')).toBeInTheDocument();
    expect(within(items[0]!).getByTestId('status-checking')).toHaveTextContent('確認中');
    expect(within(items[1]!).getByTestId('status-approved')).toHaveTextContent('承認');
    expect(within(items[1]!).getByTestId('status-approved').querySelector('svg')).not.toBeNull();
  });

  it('0 件なら空の文を出す', () => {
    render(<ReportList rows={[]} emptyText="報告はまだありません" />);
    expect(screen.getByTestId('report-list-empty')).toHaveTextContent('報告はまだありません');
  });

  it('次のページがあれば「次の 50 件」を出し、押すと onNext を呼ぶ', async () => {
    const onNext = vi.fn();
    render(<ReportList rows={[row(1)]} emptyText="" hasNext onNext={onNext} totalCount={51} />);
    expect(screen.getByTestId('report-list-total')).toHaveTextContent('51 件');
    await userEvent.click(screen.getByTestId('report-list-next'));
    expect(onNext).toHaveBeenCalled();
  });

  it('次のページがなければボタンを出さない。行を押すと onSelect に reportId', async () => {
    const onSelect = vi.fn();
    render(<ReportList rows={[row(7)]} emptyText="" onSelect={onSelect} showHunterName />);
    expect(screen.queryByTestId('report-list-next')).toBeNull();
    expect(screen.getByText('ハンター 7')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('report-row'));
    expect(onSelect).toHaveBeenCalledWith('r-7');
  });
});
