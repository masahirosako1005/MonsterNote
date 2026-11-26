// 初回の手続き（UC21）。依頼元・管理者はパスワードの変更だけ（BR11.7）。済んだら一覧へ。
import { useNavigate } from 'react-router-dom';
import { ProcedureFlow } from '@ui-kit/components/ProcedureFlow';
import { useSession } from '@ui-kit/session/SessionContext';

export function ProcedurePage() {
  const { store } = useSession();
  const navigate = useNavigate();
  return (
    <ProcedureFlow api={store.api} onComplete={() => navigate('/reports', { replace: true })} />
  );
}
