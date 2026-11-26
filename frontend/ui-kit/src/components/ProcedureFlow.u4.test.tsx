// ProcedureFlow の試験（BR11.7: パスワード→同意→従事者番号の順）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcedureFlow } from './ProcedureFlow';
import type { ApiClient } from '../api/client';
import type { MeView } from '../api/me';

function fakeApi(sequence: MeView[]): ApiClient {
  let i = 0;
  return {
    get: vi
      .fn()
      .mockImplementation(() => Promise.resolve(sequence[Math.min(i++, sequence.length - 1)])),
    post: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    del: vi.fn(),
  } as unknown as ApiClient;
}

const base: MeView = {
  accountId: 'hunter-a',
  role: 'hunter',
  displayName: 'A',
  mustChangePassword: false,
  consentRequired: false,
  hunterNumberRequired: false,
};

describe('ProcedureFlow', () => {
  it('mustChangePasswordならパスワードの変更画面を出す', async () => {
    const api = fakeApi([{ ...base, mustChangePassword: true }]);
    render(<ProcedureFlow api={api} onComplete={vi.fn()} />);
    expect(await screen.findByTestId('new-password')).toBeInTheDocument();
  });

  it('パスワード変更後は同意の画面に進む（ハンター）', async () => {
    const api = fakeApi([
      { ...base, mustChangePassword: true, consentRequired: true, hunterNumberRequired: true },
      { ...base, consentRequired: true, hunterNumberRequired: true },
    ]);
    render(<ProcedureFlow api={api} onComplete={vi.fn()} />);
    await userEvent.type(await screen.findByTestId('new-password'), 'abcd1234');
    await userEvent.click(screen.getByTestId('password-change-submit'));
    expect(await screen.findByTestId('consent-agree')).toBeInTheDocument();
  });

  it('すべて済んでいればonCompleteを呼ぶ', async () => {
    const onComplete = vi.fn();
    const api = fakeApi([base]);
    render(<ProcedureFlow api={api} onComplete={onComplete} />);
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('依頼元・管理者はconsentRequired・hunterNumberRequiredが常にfalseなので、パスワード変更後すぐ完了する', async () => {
    const onComplete = vi.fn();
    const api = fakeApi([
      { ...base, role: 'requester', mustChangePassword: true },
      { ...base, role: 'requester' },
    ]);
    render(<ProcedureFlow api={api} onComplete={onComplete} />);
    await userEvent.type(await screen.findByTestId('new-password'), 'abcd1234');
    await userEvent.click(screen.getByTestId('password-change-submit'));
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
