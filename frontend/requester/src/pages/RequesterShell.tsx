// 依頼元の画面の枠（メニュー: 一覧・ログアウト）
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@ui-kit/components/AppShell';
import { useSession } from '@ui-kit/session/SessionContext';

export function RequesterShell({ children }: { children: ReactNode }) {
  const { store } = useSession();
  const navigate = useNavigate();
  return (
    <AppShell
      title="MonsterNote 依頼元"
      menuItems={[
        { label: '報告の一覧', testId: 'menu-list', onClick: () => navigate('/reports') },
        {
          label: 'ログアウト',
          testId: 'logout',
          onClick: () => void store.logout().finally(() => navigate('/login', { replace: true })),
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
