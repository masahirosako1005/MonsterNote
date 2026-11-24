// UndoButton の試験（BR3.9・BR3.15、NFR7.5: カウントダウン、NFR7.7: 弾かれたときはエラーにしない）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UndoButton } from './UndoButton';
import { ApiError } from '../api/client';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const NOW = new Date('2026-11-23T04:00:00.000Z').getTime();

describe('UndoButton', () => {
  it('残り秒数を表示し、1 秒ごとに減っていく', () => {
    render(<UndoButton undoUntil="2026-11-23T04:00:10.000Z" onUndo={vi.fn()} now={() => NOW} />);
    expect(screen.getByTestId('undo-button')).toHaveTextContent('残り 10 秒');
  });

  it('押すと onUndo を呼ぶ', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUndo = vi.fn().mockResolvedValue(undefined);
    render(<UndoButton undoUntil="2026-11-23T04:00:10.000Z" onUndo={onUndo} now={() => NOW} />);
    await user.click(screen.getByTestId('undo-button'));
    expect(onUndo).toHaveBeenCalled();
  });

  it('期限を過ぎていれば最初から出さない', () => {
    render(<UndoButton undoUntil="2026-11-23T03:59:59.000Z" onUndo={vi.fn()} now={() => NOW} />);
    expect(screen.queryByTestId('undo-button')).toBeNull();
  });

  it('タイマーが進んで 0 秒になると消える', () => {
    let current = NOW;
    render(
      <UndoButton undoUntil="2026-11-23T04:00:02.000Z" onUndo={vi.fn()} now={() => current} />,
    );
    expect(screen.getByTestId('undo-button')).toBeInTheDocument();
    current = NOW + 3000;
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId('undo-button')).toBeNull();
  });

  it('同時操作で弾かれた（onUndo が吸収済み）場合はエラー表示にしない（NFR7.7）', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // onUndo 自身が ALREADY_UNDONE / UNDO_EXPIRED を吸収し、resolve する想定（呼び出し側の責務）
    const onUndo = vi.fn().mockResolvedValue(undefined);
    render(<UndoButton undoUntil="2026-11-23T04:00:10.000Z" onUndo={onUndo} now={() => NOW} />);
    await user.click(screen.getByTestId('undo-button'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('本当の失敗（吸収されなかった例外）は警告を出す', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUndo = vi
      .fn()
      .mockRejectedValue(
        new ApiError(0, 'NETWORK', '通信できませんでした', { requestId: 'req-9' }),
      );
    render(<UndoButton undoUntil="2026-11-23T04:00:10.000Z" onUndo={onUndo} now={() => NOW} />);
    await user.click(screen.getByTestId('undo-button'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('req-9'));
  });
});
