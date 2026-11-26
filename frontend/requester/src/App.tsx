// RequesterApp: 依頼元用の画面（R1 ログイン → R2 一覧 → R3 詳細と承認）。画面ごとに分けて読み込む（NFR9.2）。
// U4: 管理者の画面（アカウント・設定・操作の記録・すべて削除）もこのアプリの中にメニューとして収める。
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppFrame } from '@ui-kit/AppFrame';
import type { AppConfig } from '@ui-kit/config';
import { RequireSession } from '@ui-kit/session/SessionContext';
import { staffTheme } from '@ui-kit/theme';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ProcedurePage = lazy(() =>
  import('./pages/ProcedurePage').then((m) => ({ default: m.ProcedurePage })),
);
const ListPage = lazy(() => import('./pages/ListPage').then((m) => ({ default: m.ListPage })));
const DetailPage = lazy(() =>
  import('./pages/DetailPage').then((m) => ({ default: m.DetailPage })),
);
const AccountsPage = lazy(() =>
  import('./pages/admin/AccountsPage').then((m) => ({ default: m.AccountsPage })),
);
const AccountCreatePage = lazy(() =>
  import('./pages/admin/AccountCreatePage').then((m) => ({ default: m.AccountCreatePage })),
);
const AccountDetailPage = lazy(() =>
  import('./pages/admin/AccountDetailPage').then((m) => ({ default: m.AccountDetailPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const AuditLogPage = lazy(() =>
  import('./pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);
const DeleteAllPage = lazy(() =>
  import('./pages/admin/DeleteAllPage').then((m) => ({ default: m.DeleteAllPage })),
);

export interface RequesterAppProps {
  config: AppConfig;
  initialPath?: string;
}

export function RequesterApp({ config, initialPath }: RequesterAppProps) {
  const guarded = (element: JSX.Element) => <RequireSession>{element}</RequireSession>;
  return (
    <AppFrame
      theme={staffTheme}
      apiBaseUrl={config.apiBaseUrl}
      role={['requester', 'admin']}
      initialPath={initialPath}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/procedure" element={guarded(<ProcedurePage />)} />
        <Route path="/reports" element={guarded(<ListPage />)} />
        <Route path="/reports/:reportId" element={guarded(<DetailPage />)} />
        <Route path="/admin/accounts" element={guarded(<AccountsPage />)} />
        <Route path="/admin/accounts/new" element={guarded(<AccountCreatePage />)} />
        <Route path="/admin/accounts/:accountId" element={guarded(<AccountDetailPage />)} />
        <Route path="/admin/settings" element={guarded(<SettingsPage />)} />
        <Route path="/admin/audit" element={guarded(<AuditLogPage />)} />
        <Route path="/admin/delete" element={guarded(<DeleteAllPage />)} />
        <Route path="*" element={<Navigate to="/reports" replace />} />
      </Routes>
    </AppFrame>
  );
}
