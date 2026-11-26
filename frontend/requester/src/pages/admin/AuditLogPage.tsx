// A6 操作の記録（UC27。BR12.1）
import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { AuditTable, type AuditEntryRow } from '@ui-kit/components/AuditTable';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { listAuditEntries } from '../../admin-api';
import { RequesterShell } from '../RequesterShell';

export function AuditLogPage() {
  const { store } = useSession();
  const [rows, setRows] = useState<AuditEntryRow[]>();
  const [cursor, setCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    listAuditEntries(store.api, cursor).then(
      (res) => {
        if (!active) return;
        setRows(res.items);
        setNextCursor(res.nextCursor);
      },
      () => {
        if (active) setError('読めませんでした');
      },
    );
    return () => {
      active = false;
    };
  }, [store, cursor]);

  return (
    <RequesterShell>
      {error && <Alert severity="error">{error}</Alert>}
      {!rows && !error ? (
        <Loading />
      ) : (
        <AuditTable
          rows={rows ?? []}
          hasNext={Boolean(nextCursor)}
          onNext={() => nextCursor && setCursor(nextCursor)}
        />
      )}
    </RequesterShell>
  );
}
