// 初回の手続き（UC21）。すべて済んだらホームへ（BR11.7）。
import { useNavigate } from 'react-router-dom';
import { ProcedureFlow } from '@ui-kit/components/ProcedureFlow';
import { useSession } from '@ui-kit/session/SessionContext';

export function ProcedurePage() {
  const { store } = useSession();
  const navigate = useNavigate();
  return <ProcedureFlow api={store.api} onComplete={() => navigate('/', { replace: true })} />;
}
