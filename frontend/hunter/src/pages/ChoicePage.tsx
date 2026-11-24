// 報告の作成 2/3: 種類と雌雄（UC2 の 3、BR2.4）。両方を選ぶまで「次へ」は押せない。
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { BigChoice } from '@ui-kit/components/BigChoice';
import { StepHeader } from '@ui-kit/components/StepHeader';
import { SEX_OPTIONS, SPECIES_OPTIONS } from '@ui-kit/labels';
import { confirmDiscard, useHunter } from '../context';
import { HunterShell } from './HunterShell';

export function ChoicePage() {
  const { draft, setDraft, clearDraft } = useHunter();
  const navigate = useNavigate();
  if (!draft.photoId) return <Navigate to="/report/photo" replace />;
  return (
    <HunterShell>
      <StepHeader
        step={2}
        total={3}
        title="種類と雌雄"
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
        onChange={(species) => setDraft((d) => ({ ...d, species }))}
      />
      <BigChoice
        label="雌雄"
        name="sex"
        options={SEX_OPTIONS}
        value={draft.sex}
        onChange={(sex) => setDraft((d) => ({ ...d, sex }))}
      />
      <Button
        variant="contained"
        fullWidth
        disabled={!draft.species || !draft.sex}
        onClick={() => navigate('/report/submit')}
        data-testid="choice-next"
      >
        次へ
      </Button>
    </HunterShell>
  );
}
