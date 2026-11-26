// 重複の確認ダイアログの試験（BR7.1・BR7.3: 氏名・写真は出さない。「別の個体なので送る」「送るのをやめる」）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDuplicateDialog } from './ConfirmDuplicateDialog';

const matches = [
  { species: 'boar' as const, capturedAt: '2026-11-20T03:00:00.000Z', distanceMeters: 300 },
  { species: 'boar' as const, capturedAt: '2026-11-19T03:00:00.000Z', distanceMeters: 900 },
];

describe('ConfirmDuplicateDialog', () => {
  it('開いているとき、相手ごとに種類・捕獲日時・おおよその距離を表示する', () => {
    render(
      <ConfirmDuplicateDialog open matches={matches} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const rows = screen.getAllByTestId('duplicate-match-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('イノシシ');
    expect(rows[0]).toHaveTextContent('300');
  });

  it('氏名・写真・reportId は出さない', () => {
    render(
      <ConfirmDuplicateDialog open matches={matches} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(/report-|hunter-|img/);
  });

  it('「別の個体なので送る」で onConfirm、「送るのをやめる」で onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDuplicateDialog open matches={matches} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByTestId('duplicate-confirm'));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('duplicate-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('open=false のときは表示しない', () => {
    render(
      <ConfirmDuplicateDialog
        open={false}
        matches={matches}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
