// R2 報告の一覧（UC3、BR4.2・BR4.4）。新しい順に 50 件、「次の 50 件」で次のページ。
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { ApiError } from '@ui-kit/api/client';
import { ReportList } from '@ui-kit/components/ReportList';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { listReports, type ListPage as Page } from '../api';
import { RequesterShell } from './RequesterShell';

export function ListPage() {
  const { store } = useSession();
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>();
  // 読んだページの cursor（1 ページ目は undefined）
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [error, setError] = useState<string>();

  const current = cursors[cursors.length - 1];
  useEffect(() => {
    let active = true;
    // 状態は読み終わってから書き換える（効果の中で同期的に setState しない）
    listReports(store.api, current).then(
      (result) => {
        if (!active) return;
        setPage(result);
        setError(undefined);
      },
      (err: unknown) => {
        if (!active) return;
        setError(
          `一覧を読めませんでした。${err instanceof ApiError && err.requestId ? `（問い合わせ番号: ${err.requestId}）` : ''}`,
        );
      },
    );
    return () => {
      active = false;
    };
  }, [store, current]);

  return (
    <RequesterShell>
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          報告の一覧
        </Typography>
        {cursors.length > 1 && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="text"
              onClick={() => setCursors((c) => c.slice(0, -1))}
              data-testid="report-list-prev"
            >
              前の 50 件
            </Button>
            <Typography>{cursors.length} ページ目</Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!page && !error ? (
          <Loading />
        ) : (
          <ReportList
            rows={page?.items ?? []}
            emptyText="報告はまだありません"
            totalCount={page?.totalCount}
            hasNext={Boolean(page?.nextCursor)}
            onNext={() =>
              page?.nextCursor && setCursors((c) => [...c, page.nextCursor ?? undefined])
            }
            onSelect={(reportId) => navigate(`/reports/${encodeURIComponent(reportId)}`)}
            showHunterName
          />
        )}
      </Stack>
    </RequesterShell>
  );
}
