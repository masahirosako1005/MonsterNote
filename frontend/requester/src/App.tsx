// RequesterApp: 依頼元用の画面（R1 ログイン → R2 一覧 → R3 詳細と承認）。画面ごとに分けて読み込む（NFR9.2）。
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppFrame } from '@ui-kit/AppFrame';
import type { AppConfig } from '@ui-kit/config';
import { RequireSession } from '@ui-kit/session/SessionContext';
import { staffTheme } from '@ui-kit/theme';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ListPage = lazy(() => import('./pages/ListPage').then((m) => ({ default: m.ListPage })));
const DetailPage = lazy(() =>
  import('./pages/DetailPage').then((m) => ({ default: m.DetailPage })),
);

export interface RequesterAppProps {
  config: AppConfig;
  initialPath?: string;
}

export function RequesterApp({ config, initialPath }: RequesterAppProps) {
  return (
    <AppFrame
      theme={staffTheme}
      apiBaseUrl={config.apiBaseUrl}
      role="requester"
      initialPath={initialPath}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/reports"
          element={
            <RequireSession>
              <ListPage />
            </RequireSession>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <RequireSession>
              <DetailPage />
            </RequireSession>
          }
        />
        <Route path="*" element={<Navigate to="/reports" replace />} />
      </Routes>
    </AppFrame>
  );
}
