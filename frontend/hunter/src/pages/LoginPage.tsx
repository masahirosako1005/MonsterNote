// H1 ログイン（UC1）
import { Navigate, useNavigate } from 'react-router-dom';
import { LoginForm } from '@ui-kit/components/LoginForm';
import { useSession } from '@ui-kit/session/SessionContext';

export function LoginPage() {
  const { store, account } = useSession();
  const navigate = useNavigate();
  if (account) return <Navigate to="/" replace />;
  return (
    <LoginForm
      title="MonsterNote ハンターのログイン"
      onSubmit={async (loginId, password) => {
        await store.login(loginId, password);
        navigate('/', { replace: true });
      }}
    />
  );
}
