// A1 アカウントの一覧（BR11.1・BR11.9）
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { AccountTable } from '@ui-kit/components/AccountTable';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { listAccounts, type AccountRow } from '../../admin-api';
import { RequesterShell } from '../RequesterShell';

export function AccountsPage() {
  const { store } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AccountRow[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    listAccounts(store.api).then(
      (res) => {
        if (active) setRows(res.items);
      },
      () => {
        if (active) setError('一覧を読めませんでした');
      },
    );
    return () => {
      active = false;
    };
  }, [store]);

  return (
    <RequesterShell>
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          アカウント
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/admin/accounts/new')}
          data-testid="account-create-link"
          sx={{ alignSelf: 'flex-start' }}
        >
          アカウントを作成
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {!rows && !error ? (
          <Loading />
        ) : (
          <AccountTable
            rows={rows ?? []}
            onSelect={(accountId) => navigate(`/admin/accounts/${encodeURIComponent(accountId)}`)}
          />
        )}
      </Stack>
    </RequesterShell>
  );
}
