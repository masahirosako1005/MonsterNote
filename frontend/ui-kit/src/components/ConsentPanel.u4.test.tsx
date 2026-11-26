// ConsentPanel の試験（BR11.5・Q4）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentPanel } from './ConsentPanel';

describe('ConsentPanel', () => {
  it('同意するとonDecide(true)を呼ぶ', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<ConsentPanel onDecide={onDecide} />);
    await userEvent.click(screen.getByTestId('consent-agree'));
    expect(onDecide).toHaveBeenCalledWith(true);
  });

  it('同意しないと、報告できない旨と「管理者にご連絡ください」を表示する（AC1.3.2）', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<ConsentPanel onDecide={onDecide} />);
    await userEvent.click(screen.getByTestId('consent-decline'));
    expect(onDecide).toHaveBeenCalledWith(false);
    expect(await screen.findByTestId('consent-declined-message')).toHaveTextContent(
      '管理者にご連絡ください',
    );
  });
});
