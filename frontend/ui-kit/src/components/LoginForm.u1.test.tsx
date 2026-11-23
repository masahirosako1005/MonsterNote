// LoginForm の試験（BR1.1、AC1.1.3: エラーのとき入れた ID は残す）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('ID とパスワードを入れて「ログイン」を押すと onSubmit を呼ぶ', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm title="ハンターのログイン" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('login-id'), 'hunter01');
    await userEvent.type(screen.getByTestId('login-password'), 'pass1234');
    await userEvent.click(screen.getByTestId('login-submit'));
    expect(onSubmit).toHaveBeenCalledWith('hunter01', 'pass1234');
  });

  it('空のまま押すと「入れてください」を表示し、onSubmit を呼ばない', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm title="t" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByTestId('login-submit'));
    expect(screen.getAllByText('入れてください')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('失敗したらエラーを表示し、入れた ID は残し、パスワードは消す', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('ID かパスワードが違います'));
    render(<LoginForm title="t" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('login-id'), 'hunter01');
    await userEvent.type(screen.getByTestId('login-password'), 'wrong');
    await userEvent.click(screen.getByTestId('login-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('ID かパスワードが違います');
    expect(screen.getByTestId('login-id')).toHaveValue('hunter01');
    expect(screen.getByTestId('login-password')).toHaveValue('');
  });

  it('送信中はボタンを押せない', async () => {
    let resolve: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<LoginForm title="t" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('login-id'), 'a');
    await userEvent.type(screen.getByTestId('login-password'), 'b');
    await userEvent.click(screen.getByTestId('login-submit'));
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    resolve();
  });
});
