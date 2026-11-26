// AccountTable の試験（BR11.1・BR11.9）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountTable, canShowDisable, type AccountTableRow } from './AccountTable';

const rows: AccountTableRow[] = [
  {
    accountId: 'admin-a',
    loginId: 'admin01',
    displayName: '管理者A',
    role: 'admin',
    status: 'active',
  },
  {
    accountId: 'admin-b',
    loginId: 'admin02',
    displayName: '管理者B',
    role: 'admin',
    status: 'active',
  },
  {
    accountId: 'hunter-a',
    loginId: 'hunter01',
    displayName: 'ハンターA',
    role: 'hunter',
    status: 'active',
  },
];

describe('canShowDisable', () => {
  it('自分自身には無効化を出さない（BR11.9）', () => {
    expect(canShowDisable(rows[0]!, 'admin-a', rows)).toBe(false);
  });

  it('有効な管理者が2人以上なら、ほかの管理者には出す', () => {
    expect(canShowDisable(rows[1]!, 'admin-a', rows)).toBe(true);
  });

  it('有効な管理者が1人だけなら、その管理者には出さない', () => {
    const onlyOneAdmin = [rows[0]!, rows[2]!];
    expect(canShowDisable(rows[0]!, 'admin-b', onlyOneAdmin)).toBe(false);
  });

  it('無効なアカウントには出さない', () => {
    const disabled = { ...rows[2]!, status: 'disabled' as const };
    expect(canShowDisable(disabled, 'admin-a', [disabled])).toBe(false);
  });

  it('管理者以外は2人以上の制約を受けない', () => {
    expect(canShowDisable(rows[2]!, 'admin-a', rows)).toBe(true);
  });
});

describe('AccountTable', () => {
  it('空なら空の表示', () => {
    render(<AccountTable rows={[]} onSelect={vi.fn()} />);
    expect(screen.getByTestId('account-table-empty')).toBeInTheDocument();
  });

  it('詳細を押すとonSelectを呼ぶ', async () => {
    const onSelect = vi.fn();
    render(<AccountTable rows={rows} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByTestId('account-detail-button')[0]!);
    expect(onSelect).toHaveBeenCalledWith('admin-a');
  });
});
