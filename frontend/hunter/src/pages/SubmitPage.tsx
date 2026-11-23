// 報告の作成 3/3: 送信（UC2 の 4〜9、BR2.5・BR2.6）。位置が取れるまで送れない。失敗しても選んだ内容は残し、同じ送信のキーで送り直す。
import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { ApiError } from '@ui-kit/api/client';
import { LocationGate, type GeoPoint } from '@ui-kit/components/LocationGate';
import { StepHeader } from '@ui-kit/components/StepHeader';
import { SubmitButton, type SubmitState } from '@ui-kit/components/SubmitButton';
import { sexLabel, speciesLabel } from '@ui-kit/labels';
import { useSession } from '@ui-kit/session/SessionContext';
import { submitReport } from '../api';
import { newSubmissionKey, useHunter } from '../context';
import { HunterShell } from './HunterShell';

export function SubmitPage() {
  const { store } = useSession();
  const { deps, draft, setDraft, clearDraft, setJustSubmitted } = useHunter();
  const navigate = useNavigate();
  const [location, setLocation] = useState<GeoPoint>();
  const [state, setState] = useState<SubmitState>('idle');
  const [failure, setFailure] = useState<{ requestId?: string; message?: string }>({});
  const onLocation = useCallback((p: GeoPoint) => setLocation(p), []);

  if (!draft.photoId || !draft.species || !draft.sex)
    return <Navigate to="/report/photo" replace />;
  const { photoId, species, sex } = draft;

  const submit = async () => {
    if (!location) return;
    // 最初の「送る」で送信のキーを作り、「もう一度」でも同じキーを使う
    const submissionKey = draft.submissionKey ?? newSubmissionKey();
    if (!draft.submissionKey) setDraft((d) => ({ ...d, submissionKey }));
    setState('sending');
    try {
      const reportId = await submitReport(
        store.api,
        { submissionKey, photoId, species, sex, location },
        deps.sleep,
      );
      setJustSubmitted({ reportId, species, submittedAt: new Date().toISOString() });
      // 作成中の内容は完了の画面で消す（ここで消すと、この画面が写真の画面に戻してしまう）
      navigate('/report/done', { replace: true });
    } catch (err) {
      setFailure(
        err instanceof ApiError
          ? { requestId: err.requestId, message: err.status === 0 ? undefined : err.message }
          : {},
      );
      setState('failed');
    }
  };

  return (
    <HunterShell>
      <StepHeader
        step={3}
        total={3}
        title="送る"
        onBack={() => navigate('/report/choice')}
        onCancel={() => {
          clearDraft();
          navigate('/');
        }}
      />
      <Stack spacing={2}>
        <Typography data-testid="summary-species">種類: {speciesLabel(species)}</Typography>
        <Typography data-testid="summary-sex">雌雄: {sexLabel(sex)}</Typography>
        <LocationGate onLocation={onLocation} getPosition={deps.getPosition} />
        <SubmitButton
          state={state}
          disabled={!location}
          onSubmit={() => void submit()}
          requestId={failure.requestId}
          errorMessage={failure.message}
        />
      </Stack>
    </HunterShell>
  );
}
