// AccountForm の試験（BR11.2）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountForm } from './AccountForm';

describe('AccountForm', () => {
  it('ハンターを作成する（所属は不要）', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AccountForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('account-display-name'), 'ハンター9');
    await userEvent.type(screen.getByTestId('account-login-id'), 'hunter09');
    await userEvent.click(screen.getByTestId('account-form-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      role: 'hunter',
      loginId: 'hunter09',
      displayName: 'ハンター9',
      organization: undefined,
    });
  });

  it('依頼元は所属がないと確定できない（AC6.1.2）', async () => {
    const onSubmit = vi.fn();
    render(<AccountForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('combobox', { name: '役割' }));
    await userEvent.click(await screen.findByRole('option', { name: '依頼元' }));
    await userEvent.type(screen.getByTestId('account-display-name'), '担当');
    await userEvent.type(screen.getByTestId('account-login-id'), 'city09');
    await userEvent.click(screen.getByTestId('account-form-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('所属を選んでください')).toBeInTheDocument();
  });

  it('IDが重なるとエラーを表示する（AC6.1.3）', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('この ID は使われています'));
    render(<AccountForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByTestId('account-display-name'), 'ハンター');
    await userEvent.type(screen.getByTestId('account-login-id'), 'hunter01');
    await userEvent.click(screen.getByTestId('account-form-submit'));
    expect(await screen.findByText('この ID は使われています')).toBeInTheDocument();
  });
});
