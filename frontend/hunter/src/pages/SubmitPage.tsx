// 報告の作成 3/3: 送信（UC9、BR2.6・BR2.16・BR7.1・BR7.2）。失敗しても選んだ内容は残し、同じ送信のキーで送り直す。
// U2: 位置は地図（MapPicker）で指す。重複の疑い（409）は確認ダイアログで「別の個体なので送る」か「やめる」。
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { ApiError } from '@ui-kit/api/client';
import {
  ConfirmDuplicateDialog,
  type DuplicateMatchView,
} from '@ui-kit/components/ConfirmDuplicateDialog';
import { MapPicker, type GeoPoint, type TargetArea } from '@ui-kit/components/MapPicker';
import { StepHeader } from '@ui-kit/components/StepHeader';
import { SubmitButton, type SubmitState } from '@ui-kit/components/SubmitButton';
import { sexLabel, speciesLabel } from '@ui-kit/labels';
import { useSession } from '@ui-kit/session/SessionContext';
import { DuplicateSuspectedError, getReportSettings, submitReport } from '../api';
import { confirmDiscard, newSubmissionKey, useHunter } from '../context';
import { HunterShell } from './HunterShell';

/** 対象地域が読めないとき・初めて開いたときの地図の中心（日本のおおよその中心） */
const DEFAULT_LOCATION: GeoPoint = { lat: 36.2, lng: 138.3 };

export function SubmitPage() {
  const { store } = useSession();
  const { deps, draft, setDraft, clearDraft, setJustSubmitted } = useHunter();
  const navigate = useNavigate();
  const [location, setLocation] = useState<GeoPoint>(DEFAULT_LOCATION);
  const [targetArea, setTargetArea] = useState<TargetArea>();
  const [state, setState] = useState<SubmitState>('idle');
  const [failure, setFailure] = useState<{ requestId?: string; message?: string }>({});
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatchView[]>();

  useEffect(() => {
    // BR2.16: 対象地域は地図の警告のために読む（読めなくても送信そのものは止めない）
    let active = true;
    getReportSettings(store.api).then(
      (area) => active && setTargetArea(area),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [store]);

  if (!draft.photoId || !draft.species || !draft.sex)
    return <Navigate to="/report/photo" replace />;
  const { photoId, species, sex } = draft;

  const submit = async (confirmedNotDuplicate = false) => {
    // 最初の「送る」で送信のキーを作り、「もう一度」でも同じキーを使う
    const submissionKey = draft.submissionKey ?? newSubmissionKey();
    if (!draft.submissionKey) setDraft((d) => ({ ...d, submissionKey }));
    setState('sending');
    try {
      const reportId = await submitReport(
        store.api,
        { submissionKey, photoId, species, sex, location, confirmedNotDuplicate },
        deps.sleep,
      );
      setJustSubmitted({ reportId, species, submittedAt: new Date().toISOString() });
      // 作成中の内容は完了の画面で消す（ここで消すと、この画面が写真の画面に戻してしまう）
      navigate('/report/done', { replace: true });
    } catch (err) {
      if (err instanceof DuplicateSuspectedError) {
        setDuplicateMatches(err.matches); // BR7.1: 保存の前に重複の疑いを知らせる
        setState('idle');
        return;
      }
      setFailure(
        err instanceof ApiError
          ? { requestId: err.requestId, message: err.status === 0 ? undefined : err.message }
          : {},
      );
      setState('failed');
    }
  };

  const onDuplicateConfirm = () => {
    setDuplicateMatches(undefined);
    void submit(true); // BR7.2: 確かめたあとの送り直しは、問い合わせを省く
  };

  const onDuplicateCancel = () => {
    // BR7.4・BR2.19: 消す前に確かめる
    if (!confirmDiscard()) return;
    setDuplicateMatches(undefined);
    navigate('/');
    // 下書きを消すのは、移動が終わってから（同じ描画で draft が空になり、この画面自身の
    // 「写真がなければ /report/photo へ」の案内が先に効いてしまわないように、1 回あとに回す）
    setTimeout(clearDraft, 0);
  };

  return (
    <HunterShell>
      <StepHeader
        step={3}
        total={3}
        title="送る"
        onBack={() => navigate('/report/choice')}
        onCancel={() => {
          // BR2.19: 消す前に確かめる
          if (!confirmDiscard()) return;
          navigate('/');
          setTimeout(clearDraft, 0);
        }}
      />
      <Stack spacing={2}>
        <Typography data-testid="summary-species">種類: {speciesLabel(species)}</Typography>
        <Typography data-testid="summary-sex">雌雄: {sexLabel(sex)}</Typography>
        <MapPicker value={location} onChange={setLocation} targetArea={targetArea} />
        <SubmitButton
          state={state}
          onSubmit={() => void submit(false)}
          requestId={failure.requestId}
          errorMessage={failure.message}
        />
      </Stack>
      <ConfirmDuplicateDialog
        open={duplicateMatches !== undefined}
        matches={duplicateMatches ?? []}
        onConfirm={onDuplicateConfirm}
        onCancel={onDuplicateCancel}
      />
    </HunterShell>
  );
}
