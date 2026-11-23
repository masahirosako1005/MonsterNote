// 報告の作成 1/3: 全身の写真（UC2 の 2、BR2.2）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@mui/material';
import { PhotoPicker } from '@ui-kit/components/PhotoPicker';
import { StepHeader } from '@ui-kit/components/StepHeader';
import { useSession } from '@ui-kit/session/SessionContext';
import { uploadBodyPhoto } from '../api';
import { useHunter } from '../context';
import { HunterShell } from './HunterShell';

export function PhotoPage() {
  const { store } = useSession();
  const { deps, setDraft, clearDraft } = useHunter();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const onPicked = async (photo: Blob) => {
    setUploading(true);
    setError(undefined);
    try {
      const photoId = await uploadBodyPhoto(store.api, photo);
      setDraft((d) => ({ ...d, photoId }));
      navigate('/report/choice');
    } catch {
      setError('写真を送れませんでした。もう一度選んでください');
    } finally {
      setUploading(false);
    }
  };

  return (
    <HunterShell>
      <StepHeader
        step={1}
        total={3}
        title="全身の写真"
        onCancel={() => {
          clearDraft();
          navigate('/');
        }}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <PhotoPicker onPicked={(p) => void onPicked(p)} resize={deps.resize} uploading={uploading} />
    </HunterShell>
  );
}
