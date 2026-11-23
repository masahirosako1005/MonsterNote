// DecisionBar の試験（BR3.3・BR3.6・BR3.7、AC4.3.3: 409・404 の表示、確認済みはボタンを出さない）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionBar } from './DecisionBar';
import { ApiError } from '../api/client';

describe('DecisionBar', () => {
  it('確認中なら「承認」を出し、押すと onApprove を呼んで onDecided に結果を渡す', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onDecided = vi.fn();
    render(<DecisionBar status="checking" onApprove={onApprove} onDecided={onDecided} />);
    await userEvent.click(screen.getByTestId('approve-button'));
    expect(onApprove).toHaveBeenCalled();
    expect(onDecided).toHaveBeenCalled();
  });

  it('確認済み（承認）ならボタンを出さない', () => {
    render(<DecisionBar status="approved" onApprove={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.queryByTestId('approve-button')).toBeNull();
  });

  it('409 ALREADY_DECIDED なら「すでに確認済みです」と確認した人を出し、画面を最新にする', async () => {
    const onDecided = vi.fn();
    const err = new ApiError(409, 'ALREADY_DECIDED', 'すでに確認済みです', {
      conflict: { decision: 'approved', decidedByName: '依頼元 B' },
    });
    render(
      <DecisionBar
        status="checking"
        onApprove={vi.fn().mockRejectedValue(err)}
        onDecided={onDecided}
      />,
    );
    await userEvent.click(screen.getByTestId('approve-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'すでに確認済みです（承認、依頼元 B）',
    );
    expect(onDecided).toHaveBeenCalled();
  });

  it('404 REVIEW_NOT_READY なら「まだ確認の準備ができていません」', async () => {
    const err = new ApiError(
      404,
      'REVIEW_NOT_READY',
      'まだ確認の準備ができていません。少し待ってからもう一度押してください',
    );
    render(
      <DecisionBar
        status="checking"
        onApprove={vi.fn().mockRejectedValue(err)}
        onDecided={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByTestId('approve-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('まだ確認の準備ができていません');
    expect(screen.getByTestId('approve-button')).toBeEnabled();
  });

  it('通信の失敗は「承認できませんでした」と問い合わせ番号', async () => {
    const err = new ApiError(0, 'NETWORK', '通信できませんでした', { requestId: 'req-5' });
    render(
      <DecisionBar
        status="checking"
        onApprove={vi.fn().mockRejectedValue(err)}
        onDecided={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByTestId('approve-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('承認できませんでした');
    expect(screen.getByRole('alert')).toHaveTextContent('req-5');
  });
});
