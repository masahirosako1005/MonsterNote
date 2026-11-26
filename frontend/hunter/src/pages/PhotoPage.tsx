// 報告の作成 1/3: 全身の写真（UC8 の 1、BR2.2）→ 尻尾の写真（BR2.11。必須）。
// 全身のアップロードが終わると種類の自動判別の結果を見せる（BR6.2〜BR6.4）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { DetectionWait } from '@ui-kit/components/DetectionWait';
import { PhotoPicker } from '@ui-kit/components/PhotoPicker';
import { StepHeader } from '@ui-kit/components/StepHeader';
import { speciesLabel } from '@ui-kit/labels';
import { useSession } from '@ui-kit/session/SessionContext';
import { uploadPhoto, type DetectionResultView } from '../api';
import { confirmDiscard, useHunter } from '../context';
import { HunterShell } from './HunterShell';

type Phase = 'body' | 'tail';

export function PhotoPage() {
  const { store } = useSession();
  const { deps, setDraft, clearDraft } = useHunter();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('body');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [detection, setDetection] = useState<DetectionResultView>();
  const [tailPhotoId, setTailPhotoId] = useState<string>();

  const onPickedBody = async (photo: Blob) => {
    setUploading(true);
    setError(undefined);
    setDetection(undefined);
    try {
      const { photoId, detection: result } = await uploadPhoto(store.api, photo, 'body');
      setDraft((d) => ({
        ...d,
        photoId,
        autoDetectionOutcome: result?.outcome,
        autoDetectedSpecies: result?.species,
        autoDetectionConfidence: result?.confidence,
        // BR6.4: 判別できていれば、その種類を選んだ状態にする（ハンターは選び直せる）
        species: result?.outcome === 'detected' ? result.species : d.species,
      }));
      setDetection(result);
    } catch {
      setError('写真を送れませんでした。もう一度選んでください');
    } finally {
      setUploading(false);
    }
  };

  const onPickedTail = async (photo: Blob) => {
    setUploading(true);
    setError(undefined);
    try {
      const { photoId } = await uploadPhoto(store.api, photo, 'tail');
      setDraft((d) => ({ ...d, tailPhotoId: photoId }));
      setTailPhotoId(photoId);
    } catch {
      setError('写真を送れませんでした。もう一度選んでください');
    } finally {
      setUploading(false);
    }
  };

  const onCancel = () => {
    // BR2.19: 消す前に確かめる
    if (!confirmDiscard()) return;
    navigate('/');
    setTimeout(clearDraft, 0);
  };

  if (phase === 'tail') {
    return (
      <HunterShell>
        <StepHeader step={1} total={3} title="尻尾の写真" onCancel={onCancel} />
        {error && <Alert severity="error">{error}</Alert>}
        {!tailPhotoId && (
          <PhotoPicker
            onPicked={(p) => void onPickedTail(p)}
            resize={deps.resize}
            uploading={uploading}
            label="尻尾の写真を撮る・選ぶ"
          />
        )}
        {tailPhotoId && (
          <Button
            variant="contained"
            fullWidth
            onClick={() => navigate('/report/choice')}
            data-testid="photo-tail-next"
          >
            次へ
          </Button>
        )}
      </HunterShell>
    );
  }

  return (
    <HunterShell>
      <StepHeader step={1} total={3} title="全身の写真" onCancel={onCancel} />
      {error && <Alert severity="error">{error}</Alert>}
      {!detection && (
        <>
          <PhotoPicker
            onPicked={(p) => void onPickedBody(p)}
            resize={deps.resize}
            uploading={uploading}
          />
          <DetectionWait active={uploading} />
        </>
      )}
      {detection && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {detection.outcome === 'detected' ? (
            <Typography data-testid="detection-result">
              AI の判定: {speciesLabel(detection.species)}（{detection.confidence}%）
            </Typography>
          ) : (
            <Typography data-testid="detection-result">
              判別できませんでした。手で選んでください
            </Typography>
          )}
          <Button
            variant="contained"
            fullWidth
            onClick={() => setPhase('tail')}
            data-testid="photo-next"
          >
            次へ
          </Button>
        </Stack>
      )}
    </HunterShell>
  );
}
