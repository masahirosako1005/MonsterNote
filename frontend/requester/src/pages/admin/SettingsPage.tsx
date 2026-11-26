// A5 設定（UC25。BR9.2・BR9.4）
import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { SettingsForm, type SettingsFormValues } from '@ui-kit/components/SettingsForm';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { getAdminSettings, updateAdminSettings } from '../../admin-api';
import { RequesterShell } from '../RequesterShell';

export function SettingsPage() {
  const { store } = useSession();
  const [initial, setInitial] = useState<SettingsFormValues>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getAdminSettings(store.api).then(
      (res) => {
        if (active) setInitial(res);
      },
      () => {
        if (active) setError('読めませんでした');
      },
    );
    return () => {
      active = false;
    };
  }, [store]);

  return (
    <RequesterShell>
      {error && <Alert severity="error">{error}</Alert>}
      {!initial && !error ? (
        <Loading />
      ) : (
        initial && (
          <SettingsForm
            initial={initial}
            onSubmit={(values) => updateAdminSettings(store.api, values)}
          />
        )
      )}
    </RequesterShell>
  );
}
