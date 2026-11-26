// H1 ログイン（UC1）
import { Navigate } from 'react-router-dom';
import { LoginForm } from '@ui-kit/components/LoginForm';
import { useSession } from '@ui-kit/session/SessionContext';

export function LoginPage() {
  const { store, account } = useSession();
  // U4（BR11.7）: ログイン後はまず初回の手続きの状態を確かめる（ProcedurePage が済んでいれば先へ進める）。
  // store.login が account を更新した瞬間にこの再描画で遷移するため、onSubmit 側で navigate を呼ばない
  // （呼ぶと、この描画による遷移と競合して「/」に戻ってしまうことがあった）
  if (account) return <Navigate to="/procedure" replace />;
  return (
    <LoginForm
      title="MonsterNote ハンターのログイン"
      onSubmit={async (loginId, password) => {
        await store.login(loginId, password);
      }}
    />
  );
}
