// SubmitButton の試験（BR2.6、AC2.1.2: 送信中は押せず「確認しています」、AC2.1.3: 失敗で「もう一度」）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('ふだんは「送る」で、押すと onSubmit を呼ぶ', async () => {
    const onSubmit = vi.fn();
    render(<SubmitButton state="idle" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByTestId('submit-report'));
    expect(screen.getByTestId('submit-report')).toHaveTextContent('送る');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('送信中は押せず「確認しています」', () => {
    render(<SubmitButton state="sending" onSubmit={vi.fn()} />);
    expect(screen.getByTestId('submit-report')).toBeDisabled();
    expect(screen.getByTestId('submit-report')).toHaveTextContent('確認しています');
  });

  it('失敗したら「送れませんでした」と「もう一度」を表示し、問い合わせ番号を出す', async () => {
    const onSubmit = vi.fn();
    render(<SubmitButton state="failed" onSubmit={onSubmit} requestId="req-9" />);
    expect(screen.getByRole('alert')).toHaveTextContent('送れませんでした');
    expect(screen.getByRole('alert')).toHaveTextContent('req-9');
    await userEvent.click(screen.getByTestId('submit-report'));
    expect(screen.getByTestId('submit-report')).toHaveTextContent('もう一度');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('disabled（位置がまだ）なら押せない', () => {
    render(<SubmitButton state="idle" disabled onSubmit={vi.fn()} />);
    expect(screen.getByTestId('submit-report')).toBeDisabled();
  });
});
