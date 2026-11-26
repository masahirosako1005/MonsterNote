// 重複の確認ダイアログ（BR7.1・BR7.3・BR7.4）。相手ごとに種類・捕獲日時・おおよその距離だけを出す。
// 氏名・写真・reportId は出さない（DuplicateDetection の応答がすでに絞り込んでいる。NFR5.7）。
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { formatDateTime, speciesLabel } from '../labels';

export interface DuplicateMatchView {
  species: string;
  capturedAt: string;
  distanceMeters: number;
}

export interface ConfirmDuplicateDialogProps {
  open: boolean;
  matches: DuplicateMatchView[];
  /** 「別の個体なので送る」（confirmedNotDuplicate=true で送り直す。BR7.2） */
  onConfirm: () => void;
  /** 「送るのをやめる」（BR7.4。確認のうえ消してホームへは呼び出し側が行う） */
  onCancel: () => void;
}

export function ConfirmDuplicateDialog({
  open,
  matches,
  onConfirm,
  onCancel,
}: ConfirmDuplicateDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby="duplicate-dialog-title">
      <DialogTitle id="duplicate-dialog-title">近くで同じ種類の報告があります</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>同じ個体の報告でなければ、そのまま送ってください。</Typography>
        <Stack spacing={1}>
          {matches.map((match, i) => (
            <Typography key={i} data-testid="duplicate-match-row">
              {speciesLabel(match.species)}・{formatDateTime(match.capturedAt)}・約{' '}
              {match.distanceMeters} m
            </Typography>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="duplicate-cancel">
          送るのをやめる
        </Button>
        <Button variant="contained" onClick={onConfirm} data-testid="duplicate-confirm">
          別の個体なので送る
        </Button>
      </DialogActions>
    </Dialog>
  );
}
