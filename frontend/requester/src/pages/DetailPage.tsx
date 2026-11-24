// R3 報告の詳細と承認（UC3 の 3、UC4。BR2.8・BR3.3・BR3.6・BR3.7・BR6.1）。
// U2: 重複の疑いの相手の一覧も読んで見せる（C5。BR8.8・BR8.9・Q7。却下された相手の状態もあわせて出す）
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { ApiError } from '@ui-kit/api/client';
import { DecisionBar } from '@ui-kit/components/DecisionBar';
import { ReportDetail, type ReportDetailData } from '@ui-kit/components/ReportDetail';
import { STATUS_LABELS } from '@ui-kit/labels';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import {
  approve,
  getReport,
  getReview,
  listDuplicates,
  type DuplicateMatchView,
  type ReviewView,
} from '../api';
import { RequesterShell } from './RequesterShell';

export function DetailPage() {
  const { reportId = '' } = useParams();
  const { store } = useSession();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportDetailData>();
  const [review, setReview] = useState<ReviewView>();
  const [duplicates, setDuplicates] = useState<DuplicateMatchView[]>();
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
    // 重複の疑いは詳細とは別に読む（失敗しても詳細の表示は止めない）
    listDuplicates(store.api, reportId).then(
      (result) => {
        if (active) setDuplicates(result.matches);
      },
      () => {
        if (active) setDuplicates([]);
      },
    );
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
            {duplicates && duplicates.length > 0 && (
              <Stack spacing={1} data-testid="duplicate-list">
                <Typography variant="h6">重複の疑いがある報告</Typography>
                {duplicates.map((d) => (
                  <Typography key={d.matchedReportId} data-testid="duplicate-row">
                    {STATUS_LABELS[d.matchedStatus] ?? d.matchedStatus}・約{' '}
                    {d.distanceMeters ?? '—'} m
                  </Typography>
                ))}
              </Stack>
            )}
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
