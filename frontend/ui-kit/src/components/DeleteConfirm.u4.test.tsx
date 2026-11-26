// DeleteConfirm の試験（BR13.2）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConfirm } from './DeleteConfirm';

describe('DeleteConfirm', () => {
  it('件数を表示し、削除するとonConfirmを呼ぶ（BR13.2）', async () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirm reportCount={42} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.getByTestId('delete-confirm-count')).toHaveTextContent('42');
    await userEvent.click(screen.getByTestId('delete-confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('やめるとonCancelを呼ぶ（AC6.5.3）', async () => {
    const onCancel = vi.fn();
    render(<DeleteConfirm reportCount={0} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('delete-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
