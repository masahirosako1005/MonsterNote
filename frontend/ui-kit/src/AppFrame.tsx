// 2 つの画面アプリに共通の外枠: テーマ、ログインの状態、道（router）
import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Box, CircularProgress, CssBaseline, ThemeProvider, type Theme } from '@mui/material';
import { SessionProvider } from './session/SessionContext';
import type { Role } from './session/roles';

export interface AppFrameProps {
  theme: Theme;
  apiBaseUrl: string;
  role: Role;
  /** 試験では MemoryRouter の最初の道を渡す。なければブラウザの道を使う */
  initialPath?: string;
  children: ReactNode;
}

export function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress aria-label="読み込んでいます" />
    </Box>
  );
}

export function AppFrame({ theme, apiBaseUrl, role, initialPath, children }: AppFrameProps) {
  const content = (
    <SessionProvider baseUrl={apiBaseUrl} requiredRole={role}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </SessionProvider>
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {initialPath ? (
        <MemoryRouter initialEntries={[initialPath]}>{content}</MemoryRouter>
      ) : (
        <BrowserRouter>{content}</BrowserRouter>
      )}
    </ThemeProvider>
  );
}
