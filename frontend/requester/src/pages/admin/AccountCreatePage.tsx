// A2 アカウントの作成 → A4 仮のパスワードの表示（BR11.2・BR11.3）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountForm } from '@ui-kit/components/AccountForm';
import { TempPasswordPanel } from '@ui-kit/components/TempPasswordPanel';
import { useSession } from '@ui-kit/session/SessionContext';
import { ApiError } from '@ui-kit/api/client';
import { createAccount } from '../../admin-api';
import { RequesterShell } from '../RequesterShell';

export function AccountCreatePage() {
  const { store } = useSession();
  const navigate = useNavigate();
  const [result, setResult] = useState<{ loginId: string; temporaryPassword: string }>();

  if (result) {
    return (
      <RequesterShell>
        <TempPasswordPanel
          loginId={result.loginId}
          temporaryPassword={result.temporaryPassword}
          onClose={() => navigate('/admin/accounts', { replace: true })}
        />
      </RequesterShell>
    );
  }

  return (
    <RequesterShell>
      <AccountForm
        onSubmit={async (input) => {
          try {
            const created = await createAccount(store.api, input);
            setResult({ loginId: input.loginId, temporaryPassword: created.temporaryPassword });
          } catch (err) {
            if (err instanceof ApiError && err.code === 'LOGIN_ID_TAKEN') {
              throw new Error('この ID は使われています');
            }
            throw new Error('作成できませんでした');
          }
        }}
      />
    </RequesterShell>
  );
}
