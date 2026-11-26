// A7〜A9 試験運用の終わりの削除（UC26。BR13.1〜BR13.4）。
// 確認 → 5つの入口を順に呼ぶ → 終わったら件数を数え直し、0件でなければもう一度促す（AC6.5.2）。
import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { DeleteConfirm } from '@ui-kit/components/DeleteConfirm';
import { DeleteProgress, type DeleteProgressStep } from '@ui-kit/components/DeleteProgress';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { listReports } from '../../api';
import { deleteAllAt, DELETE_ENDPOINTS } from '../../admin-api';
import { RequesterShell } from '../RequesterShell';

type Phase = 'start' | 'confirm' | 'running' | 'done';

export function DeleteAllPage() {
  const { store } = useSession();
  const [phase, setPhase] = useState<Phase>('start');
  const [reportCount, setReportCount] = useState<number>();
  const [steps, setSteps] = useState<DeleteProgressStep[]>(
    DELETE_ENDPOINTS.map((e) => ({ key: e.key, label: e.label, status: 'waiting' })),
  );
  const [recheckMessage, setRecheckMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (phase !== 'start') return;
    listReports(store.api).then(
      (res) => setReportCount(res.totalCount),
      () => setError('件数を読めませんでした'),
    );
  }, [phase, store]);

  const runStep = async (key: string) => {
    const endpoint = DELETE_ENDPOINTS.find((e) => e.key === key);
    if (!endpoint) return;
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status: 'running' } : s)));
    try {
      const res = await deleteAllAt(store.api, endpoint.path);
      setSteps((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, status: 'done', deletedCount: res.deletedCount } : s,
        ),
      );
      return true;
    } catch {
      setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status: 'failed' } : s)));
      return false;
    }
  };

  const runAll = async () => {
    setPhase('running');
    for (const endpoint of DELETE_ENDPOINTS) {
      const ok = await runStep(endpoint.key);
      if (!ok) return;
    }
    // BR13.1: 5つが終わったら、もう一度数えて0件であることを確かめる（レビュー R-05）
    try {
      const res = await listReports(store.api);
      setRecheckMessage(
        res.totalCount > 0
          ? '削除のあとに新しい報告が届きました。もう一度削除してください'
          : undefined,
      );
    } catch {
      // 数え直しに失敗しても、5つの削除自体は終わっている
    }
    setPhase('done');
  };

  if (phase === 'start') {
    return (
      <RequesterShell>
        <Stack spacing={2} sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
          <Typography component="h1" variant="h5">
            試験運用の終わりの削除
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {reportCount === undefined && !error ? (
            <Loading />
          ) : (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setPhase('confirm')}
              data-testid="delete-start"
            >
              すべて削除する
            </Button>
          )}
        </Stack>
      </RequesterShell>
    );
  }

  if (phase === 'confirm') {
    return (
      <RequesterShell>
        <DeleteConfirm
          reportCount={reportCount ?? 0}
          onConfirm={() => void runAll()}
          onCancel={() => setPhase('start')}
        />
      </RequesterShell>
    );
  }

  return (
    <RequesterShell>
      <DeleteProgress
        steps={steps}
        onRetry={(key) => void runStep(key)}
        recheckMessage={phase === 'done' ? recheckMessage : undefined}
      />
    </RequesterShell>
  );
}
