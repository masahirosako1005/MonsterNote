// H2 ホーム（自分の一覧。UC5、BR4.3）。送ったばかりの報告は、一覧に届くまで先頭に仮に出す（UC2 の 8）。
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import { ApiError } from '@ui-kit/api/client';
import { ReportList, type ReportListRow } from '@ui-kit/components/ReportList';
import { useSession } from '@ui-kit/session/SessionContext';
import { Loading } from '@ui-kit/AppFrame';
import { listMyReports, type ListPage } from '../api';
import { useHunter } from '../context';
import { HunterShell } from './HunterShell';

export function HomePage() {
  const { store, account } = useSession();
  const { justSubmitted } = useHunter();
  const navigate = useNavigate();
  const [page, setPage] = useState<ListPage>();
  // 読むページの位置（1 ページ目は undefined）。変わると一覧を読み直す
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    // 状態は読み終わってから書き換える（効果の中で同期的に setState しない）
    listMyReports(store.api, cursor).then(
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
  }, [store, cursor]);

  let rows: ReportListRow[] = page?.items ?? [];
  if (justSubmitted && !cursor && !rows.some((r) => r.reportId === justSubmitted.reportId)) {
    rows = [
      {
        reportId: justSubmitted.reportId,
        species: justSubmitted.species,
        submittedAt: justSubmitted.submittedAt,
        capturedAt: justSubmitted.submittedAt,
        status: 'checking',
        pending: true,
      },
      ...rows,
    ];
  }

  return (
    <HunterShell>
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          {account?.displayName} さんの報告
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddAPhotoIcon />}
          onClick={() => navigate('/report/photo')}
          data-testid="start-report"
        >
          報告する
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {!page && !error ? (
          <Loading />
        ) : (
          <ReportList
            rows={rows}
            emptyText="まだ報告はありません。上の『報告する』から始めます"
            hasNext={Boolean(page?.nextCursor)}
            onNext={() => setCursor(page?.nextCursor ?? undefined)}
            // U3・AC5.3.2: ハンターの一覧は日数を文章で知らせる（依頼元の一覧は印だけ）
            waitingDaysVariant="message"
          />
        )}
      </Stack>
    </HunterShell>
  );
}
