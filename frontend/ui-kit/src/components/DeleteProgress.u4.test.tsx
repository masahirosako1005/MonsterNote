// DeleteProgress の試験（BR13.1）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteProgress, type DeleteProgressStep } from './DeleteProgress';

const steps: DeleteProgressStep[] = [
  { key: 'catalog', label: '一覧', status: 'done', deletedCount: 3 },
  { key: 'review', label: '確認の記録', status: 'failed' },
  { key: 'duplicate', label: '重複の索引と疑い', status: 'waiting' },
];

describe('DeleteProgress', () => {
  it('各部品の状態を表示する', () => {
    render(<DeleteProgress steps={steps} onRetry={vi.fn()} />);
    expect(screen.getByTestId('delete-step-catalog')).toHaveTextContent('終わった（3件）');
    expect(screen.getByTestId('delete-step-review')).toHaveTextContent('失敗した');
    expect(screen.getByTestId('delete-step-duplicate')).toHaveTextContent('待ち');
  });

  it('失敗した部品にはやり直すボタンが出る', async () => {
    const onRetry = vi.fn();
    render(<DeleteProgress steps={steps} onRetry={onRetry} />);
    expect(screen.queryByTestId('delete-retry-catalog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('delete-retry-review'));
    expect(onRetry).toHaveBeenCalledWith('review');
  });

  it('再確認のメッセージを表示できる（AC6.5.2）', () => {
    render(
      <DeleteProgress
        steps={steps}
        onRetry={vi.fn()}
        recheckMessage="削除のあとに新しい報告が届きました。もう一度削除してください"
      />,
    );
    expect(screen.getByTestId('delete-recheck-message')).toBeInTheDocument();
  });
});
