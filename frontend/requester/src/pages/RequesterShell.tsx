// 依頼元の画面の枠（メニュー: 一覧・ログアウト。管理者のときだけ管理の項目も出す。BR11.1）
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, type AppShellMenuItem } from '@ui-kit/components/AppShell';
import { useSession } from '@ui-kit/session/SessionContext';

export function RequesterShell({ children }: { children: ReactNode }) {
  const { store, account } = useSession();
  const navigate = useNavigate();
  const isAdmin = account?.role === 'admin';

  const menuItems: AppShellMenuItem[] = [
    { label: '報告の一覧', testId: 'menu-list', onClick: () => navigate('/reports') },
    ...(isAdmin
      ? ([
          {
            label: 'アカウント',
            testId: 'menu-admin-accounts',
            onClick: () => navigate('/admin/accounts'),
          },
          {
            label: '設定',
            testId: 'menu-admin-settings',
            onClick: () => navigate('/admin/settings'),
          },
          {
            label: '操作の記録',
            testId: 'menu-admin-audit',
            onClick: () => navigate('/admin/audit'),
          },
          {
            label: 'データの削除',
            testId: 'menu-admin-delete',
            onClick: () => navigate('/admin/delete'),
          },
        ] satisfies AppShellMenuItem[])
      : []),
    {
      label: 'ログアウト',
      testId: 'logout',
      onClick: () => void store.logout().finally(() => navigate('/login', { replace: true })),
    },
  ];

  return (
    <AppShell title="MonsterNote 依頼元" menuItems={menuItems}>
      {children}
    </AppShell>
  );
}
