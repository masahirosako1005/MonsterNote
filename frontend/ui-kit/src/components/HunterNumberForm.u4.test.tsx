// HunterNumberForm の試験（BR11.6）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HunterNumberForm, isValidHunterNumber } from './HunterNumberForm';

describe('isValidHunterNumber', () => {
  it('数字1〜20桁を受け付ける', () => {
    expect(isValidHunterNumber('123')).toBe(true);
    expect(isValidHunterNumber('')).toBe(false);
    expect(isValidHunterNumber('abc')).toBe(false);
  });
});

describe('HunterNumberForm', () => {
  it('正しい番号でonSubmitを呼ぶ（AC1.4.1）', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<HunterNumberForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('hunter-number-input'), '123');
    await userEvent.click(screen.getByTestId('hunter-number-submit'));
    expect(onSubmit).toHaveBeenCalledWith('123');
  });

  it('空では登録できない（AC1.4.2）', async () => {
    const onSubmit = vi.fn();
    render(<HunterNumberForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByTestId('hunter-number-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('番号を入れてください')).toBeInTheDocument();
  });
});
