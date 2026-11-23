// R3 報告の詳細と承認（UC3 の 3、UC4。BR2.8・BR3.3・BR3.6・BR3.7・BR6.1）
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Stack } from '@mui/material';
import { ApiError } from '@ui-kit/api/client';
import { DecisionBar } from '@ui-kit/components/DecisionBar';
import { ReportDetail, type ReportDetailData } from '@ui-kit/components/ReportDetail';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { approve, getReport, getReview, type ReviewView } from '../api';
import { RequesterShell } from './RequesterShell';

export function DetailPage() {
  const { reportId = '' } = useParams();
  const { store } = useSession();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportDetailData>();
  const [review, setReview] = useState<ReviewView>();
  const [error, setError] = useState<string>();

  const loadReview = useCallback(async () => {
    setReview(await getReview(store.api, reportId));
  }, [store, reportId]);

  useEffect(() => {
    let active = true;
    Promise.all([getReport(store.api, reportId), getReview(store.api, reportId)])
      .then(([r, v]) => {
        if (!active) return;
        setReport(r);
        setReview(v);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          `報告を読めませんでした。${err instanceof ApiError && err.requestId ? `（問い合わせ番号: ${err.requestId}）` : ''}`,
        );
      });
    return () => {
      active = false;
    };
  }, [store, reportId]);

  return (
    <RequesterShell>
      <Stack spacing={2}>
        <Button
          variant="text"
          onClick={() => navigate('/reports')}
          sx={{ alignSelf: 'flex-start' }}
          data-testid="back-to-list"
        >
          一覧に戻る
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {!report || !review ? (
          !error && <Loading />
        ) : (
          <>
            <ReportDetail
              report={report}
              status={review.status}
              decidedByName={review.decidedByName}
              decidedAt={review.decidedAt}
            />
            <DecisionBar
              status={review.status}
              onApprove={() => approve(store.api, reportId)}
              onDecided={() => void loadReview()}
            />
          </>
        )}
      </Stack>
    </RequesterShell>
  );
}
