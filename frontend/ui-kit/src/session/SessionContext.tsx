// ログインの状態を画面に配る（Provider）と、ログインしていない画面をログインに回す（RequireSession）
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { createSessionStore, type SessionAccount, type SessionStore } from './session';
import type { Role } from './roles';

interface SessionValue {
  store: SessionStore;
  account: SessionAccount | undefined;
  /** 保存した値でのログインの再開を試し終えたか */
  ready: boolean;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({
  baseUrl,
  requiredRole,
  children,
}: {
  baseUrl: string;
  requiredRole: Role;
  children: ReactNode;
}) {
  const [account, setAccount] = useState<SessionAccount>();
  const [ready, setReady] = useState(false);
  const store = useMemo(
    () => createSessionStore({ baseUrl, requiredRole, onChange: setAccount }),
    [baseUrl, requiredRole],
  );

  useEffect(() => {
    let active = true;
    void store.restore().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      store.dispose();
    };
  }, [store]);

  const value = useMemo(() => ({ store, account, ready }), [store, account, ready]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider の中で使ってください');
  return value;
}

export function RequireSession({ children }: { children: ReactNode }) {
  const { account, ready } = useSession();
  const location = useLocation();
  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress aria-label="読み込んでいます" />
      </Box>
    );
  }
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
