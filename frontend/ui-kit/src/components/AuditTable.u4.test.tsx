// AuditTable の試験（BR12.1・BR12.3・AC6.6.3）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditTable, type AuditEntryRow } from './AuditTable';

const rows: AuditEntryRow[] = [
  {
    entryId: 'e1',
    occurredAt: '2026-11-25T00:00:00.000Z',
    actorName: '市の担当',
    action: 'review.approved',
    targetType: 'report',
    targetId: 'r1',
    outcome: 'succeeded',
  },
];

describe('AuditTable', () => {
  it('利用者のIDを出さず、操作の種類を日本語で表示する（AC6.6.3）', () => {
    render(<AuditTable rows={rows} hasNext={false} onNext={vi.fn()} />);
    expect(screen.getByText(/承認/)).toBeInTheDocument();
    expect(screen.getByText(/市の担当/)).toBeInTheDocument();
    expect(screen.queryByTestId('audit-table-next')).not.toBeInTheDocument();
  });

  it('空なら空の表示', () => {
    render(<AuditTable rows={[]} hasNext={false} onNext={vi.fn()} />);
    expect(screen.getByTestId('audit-table-empty')).toBeInTheDocument();
  });

  it('次のページがあれば「次の50件」を出す', async () => {
    const onNext = vi.fn();
    render(<AuditTable rows={rows} hasNext={true} onNext={onNext} />);
    await userEvent.click(screen.getByTestId('audit-table-next'));
    expect(onNext).toHaveBeenCalled();
  });
});
