// TempPasswordPanel の試験（BR11.3・NFR7.8）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TempPasswordPanel, formatForDisplay } from './TempPasswordPanel';

describe('formatForDisplay', () => {
  it('4文字ごとに区切る（NFR7.8）', () => {
    expect(formatForDisplay('ab3def7ghk2m')).toBe('ab3d-ef7g-hk2m');
  });
});

describe('TempPasswordPanel', () => {
  it('仮のパスワードを区切り付きで表示し、閉じるとonCloseを呼ぶ', async () => {
    const onClose = vi.fn();
    render(
      <TempPasswordPanel loginId="hunter09" temporaryPassword="ab3def7ghk2m" onClose={onClose} />,
    );
    expect(screen.getByTestId('temp-password')).toHaveTextContent('ab3d-ef7g-hk2m');
    await userEvent.click(screen.getByTestId('temp-password-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
