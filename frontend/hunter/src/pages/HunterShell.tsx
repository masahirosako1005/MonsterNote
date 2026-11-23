// ハンターの画面の枠（メニュー: ホーム・ログアウト）
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@ui-kit/components/AppShell';
import { useSession } from '@ui-kit/session/SessionContext';
import { useHunter } from '../context';

export function HunterShell({ children }: { children: ReactNode }) {
  const { store } = useSession();
  const { clearDraft } = useHunter();
  const navigate = useNavigate();
  return (
    <AppShell
      title="MonsterNote"
      menuItems={[
        { label: 'ホーム', testId: 'menu-home', onClick: () => navigate('/') },
        {
          label: 'ログアウト',
          testId: 'logout',
          onClick: () => {
            clearDraft();
            void store.logout().finally(() => navigate('/login', { replace: true }));
          },
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
