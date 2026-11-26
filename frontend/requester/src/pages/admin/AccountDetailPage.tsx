// A3 アカウントの詳細（パスワードの再設定・無効化・有効化。BR11.3・BR11.9）
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { TempPasswordPanel } from '@ui-kit/components/TempPasswordPanel';
import { canShowDisable, type AccountTableRow } from '@ui-kit/components/AccountTable';
import { accountRoleLabel, ACCOUNT_STATUS_LABELS } from '@ui-kit/labels';
import { useSession } from '@ui-kit/session/SessionContext';
import { ApiError } from '@ui-kit/api/client';
import { Loading } from '@ui-kit/AppFrame';
import { listAccounts, resetPassword, setAccountStatus } from '../../admin-api';
import { RequesterShell } from '../RequesterShell';

export function AccountDetailPage() {
  const { accountId = '' } = useParams();
  const { store, account: me } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AccountTableRow[]>();
  const [error, setError] = useState<string>();
  const [tempPassword, setTempPassword] = useState<string>();
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const res = await listAccounts(store.api);
      setRows(res.items);
      setError(undefined);
    } catch {
      setError('読めませんでした');
    }
  };

  useEffect(() => {
    let active = true;
    listAccounts(store.api).then(
      (res) => {
        if (active) {
          setRows(res.items);
          setError(undefined);
        }
      },
      () => {
        if (active) setError('読めませんでした');
      },
    );
    return () => {
      active = false;
    };
  }, [store]);

  const target = rows?.find((r) => r.accountId === accountId);

  if (tempPassword && target) {
    return (
      <RequesterShell>
        <TempPasswordPanel
          loginId={target.loginId}
          temporaryPassword={tempPassword}
          onClose={() => setTempPassword(undefined)}
        />
      </RequesterShell>
    );
  }

  return (
    <RequesterShell>
      <Stack spacing={2} sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
        <Button
          variant="text"
          onClick={() => navigate('/admin/accounts')}
          sx={{ alignSelf: 'flex-start' }}
        >
          一覧に戻る
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {!rows ? (
          <Loading />
        ) : !target ? (
          <Alert severity="error">見つかりません</Alert>
        ) : (
          <>
            <Typography component="h1" variant="h5">
              {target.displayName}
            </Typography>
            <Typography>ID: {target.loginId}</Typography>
            <Typography>
              役割: {accountRoleLabel(target.role)}／状態: {ACCOUNT_STATUS_LABELS[target.status]}
            </Typography>
            <Button
              variant="contained"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                try {
                  const res = await resetPassword(store.api, target.accountId);
                  setTempPassword(res.temporaryPassword);
                } catch {
                  setError('再設定できませんでした');
                } finally {
                  setSending(false);
                }
              }}
              data-testid="account-password-reset"
            >
              パスワードを再設定する
            </Button>
            {target.status === 'active' && canShowDisable(target, me?.accountId ?? '', rows) && (
              <Button
                variant="outlined"
                color="error"
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  try {
                    await setAccountStatus(store.api, target.accountId, 'disabled');
                    await load();
                  } catch (err) {
                    setError(
                      err instanceof ApiError && err.code === 'LAST_ADMIN'
                        ? '最後の管理者は無効にできません'
                        : '無効にできませんでした',
                    );
                  } finally {
                    setSending(false);
                  }
                }}
                data-testid="account-disable"
              >
                無効にする
              </Button>
            )}
            {target.status === 'disabled' && (
              <Button
                variant="contained"
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  try {
                    await setAccountStatus(store.api, target.accountId, 'active');
                    await load();
                  } catch {
                    setError('有効に戻せませんでした');
                  } finally {
                    setSending(false);
                  }
                }}
                data-testid="account-enable"
              >
                有効に戻す
              </Button>
            )}
          </>
        )}
      </Stack>
    </RequesterShell>
  );
}
