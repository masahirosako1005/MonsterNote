// PasswordChangeForm の試験（BR11.4）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordChangeForm, isValidPassword } from './PasswordChangeForm';

describe('isValidPassword', () => {
  it('8文字以上・英字と数字を両方含むことを確かめる', () => {
    expect(isValidPassword('abcd1234')).toBe(true);
    expect(isValidPassword('abcdefg')).toBe(false);
    expect(isValidPassword('1234567')).toBe(false);
  });
});

describe('PasswordChangeForm', () => {
  it('正しいパスワードでonSubmitを呼ぶ', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PasswordChangeForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('new-password'), 'abcd1234');
    await userEvent.click(screen.getByTestId('password-change-submit'));
    expect(onSubmit).toHaveBeenCalledWith('abcd1234');
  });

  it('規則に合わないと確定できない', async () => {
    const onSubmit = vi.fn();
    render(<PasswordChangeForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('new-password'), 'short');
    await userEvent.click(screen.getByTestId('password-change-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('8 文字以上で、英字と数字を含めてください')).toBeInTheDocument();
  });
});
