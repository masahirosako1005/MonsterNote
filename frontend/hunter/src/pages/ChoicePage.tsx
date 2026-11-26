// 報告の作成 2/3: 種類・雌雄・成獣／幼獣・捕獲の方法（UC2 の 3、BR2.4）。クマなら胸の写真も
// （無ければ「撮らなかった」。BR2.17・BR2.18）。すべて揃うまで「次へ」は押せない。
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel } from '@mui/material';
import { BigChoice } from '@ui-kit/components/BigChoice';
import { PhotoPicker } from '@ui-kit/components/PhotoPicker';
import { StepHeader } from '@ui-kit/components/StepHeader';
import {
  AGE_CLASS_OPTIONS,
  CAPTURE_METHOD_OPTIONS,
  SEX_OPTIONS,
  SPECIES_OPTIONS,
} from '@ui-kit/labels';
import { useSession } from '@ui-kit/session/SessionContext';
import { uploadPhoto } from '../api';
import { confirmDiscard, useHunter } from '../context';
import { HunterShell } from './HunterShell';

export function ChoicePage() {
  const { store } = useSession();
  const { deps, draft, setDraft, clearDraft } = useHunter();
  const navigate = useNavigate();
  const [chestUploading, setChestUploading] = useState(false);
  const [chestError, setChestError] = useState<string>();
  if (!draft.photoId || !draft.tailPhotoId) return <Navigate to="/report/photo" replace />;

  const onPickedChest = async (photo: Blob) => {
    setChestUploading(true);
    setChestError(undefined);
    try {
      const { photoId } = await uploadPhoto(store.api, photo, 'chest');
      setDraft((d) => ({ ...d, chestPhotoId: photoId, chestPhotoMissing: false }));
    } catch {
      setChestError('写真を送れませんでした。もう一度選んでください');
    } finally {
      setChestUploading(false);
    }
  };

  const isBear = draft.species === 'bear';
  const chestDone = !isBear || Boolean(draft.chestPhotoId) || draft.chestPhotoMissing === true;

  return (
    <HunterShell>
      <StepHeader
        step={2}
        total={3}
        title="種類・雌雄・成獣／幼獣・捕獲の方法"
        onBack={() => navigate('/report/photo')}
        onCancel={() => {
          // BR2.19: 消す前に確かめる
          if (!confirmDiscard()) return;
          navigate('/');
          setTimeout(clearDraft, 0);
        }}
      />
      <BigChoice
        label="種類"
        name="species"
        options={SPECIES_OPTIONS}
        value={draft.species}
        onChange={(species) =>
          setDraft((d) => ({
            ...d,
            species,
            // BR2.18: クマ以外に胸の写真は結び付けられないため、選び直したら消す
            ...(species !== 'bear'
              ? { chestPhotoId: undefined, chestPhotoMissing: undefined }
              : {}),
          }))
        }
      />
      <BigChoice
        label="雌雄"
        name="sex"
        options={SEX_OPTIONS}
        value={draft.sex}
        onChange={(sex) => setDraft((d) => ({ ...d, sex }))}
      />
      <BigChoice
        label="成獣／幼獣"
        name="age-class"
        options={AGE_CLASS_OPTIONS}
        value={draft.ageClass}
        onChange={(ageClass) => setDraft((d) => ({ ...d, ageClass }))}
      />
      <BigChoice
        label="捕獲の方法"
        name="capture-method"
        options={CAPTURE_METHOD_OPTIONS}
        value={draft.captureMethod}
        onChange={(captureMethod) => setDraft((d) => ({ ...d, captureMethod }))}
      />
      {isBear && (
        <>
          {chestError && <Alert severity="error">{chestError}</Alert>}
          {!draft.chestPhotoId && !draft.chestPhotoMissing && (
            <PhotoPicker
              onPicked={(p) => void onPickedChest(p)}
              resize={deps.resize}
              uploading={chestUploading}
              label="胸の写真を撮る・選ぶ（クマ。BR2.17）"
            />
          )}
          {draft.chestPhotoId && <Button disabled>胸の写真: 送りました</Button>}
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.chestPhotoMissing === true}
                onChange={(_, checked) =>
                  setDraft((d) => ({
                    ...d,
                    chestPhotoMissing: checked,
                    ...(checked ? { chestPhotoId: undefined } : {}),
                  }))
                }
                data-testid="chest-photo-missing"
              />
            }
            label="胸の写真を撮らなかった"
          />
        </>
      )}
      <Button
        variant="contained"
        fullWidth
        disabled={
          !draft.species || !draft.sex || !draft.ageClass || !draft.captureMethod || !chestDone
        }
        onClick={() => navigate('/report/submit')}
        data-testid="choice-next"
      >
        次へ
      </Button>
    </HunterShell>
  );
}
