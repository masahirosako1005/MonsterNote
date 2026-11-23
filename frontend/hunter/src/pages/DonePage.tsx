// H8 送信完了。作成中の内容（写真の ID・種類・雌雄・送信のキー）はここで消す
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useHunter } from '../context';
import { HunterShell } from './HunterShell';

export function DonePage() {
  const navigate = useNavigate();
  const { clearDraft } = useHunter();
  // 開いたときに 1 回だけ消す（clearDraft は変わらない関数）
  useEffect(() => {
    clearDraft();
  }, [clearDraft]);
  return (
    <HunterShell>
      <Stack spacing={3} alignItems="center" sx={{ py: 4 }} data-testid="report-done">
        <CheckCircleIcon color="success" sx={{ fontSize: 96 }} />
        <Typography component="h1" variant="h5">
          送りました
        </Typography>
        <Typography>依頼元が確認すると、ホームの一覧で「承認」になります。</Typography>
        <Button variant="contained" fullWidth onClick={() => navigate('/')} data-testid="go-home">
          ホームに戻る
        </Button>
      </Stack>
    </HunterShell>
  );
}
