// 却下の理由を選ぶ画面（R4。BR3.8）。4 つの大きなボタン。「その他」を選ぶと文（1〜200 文字）の入力が出る。
// 空白だけでは確定できない。残り文字数を表示する。
import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ApiError } from '../api/client';
import { BigChoice } from './BigChoice';
import { REJECT_REASON_OPTIONS, type RejectReason } from '../labels';

export const REASON_TEXT_MAX = 200;

export interface RejectReasonFormProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (input: { reason: RejectReason; reasonText?: string }) => Promise<void>;
}

function isValid(reason: RejectReason | undefined, reasonText: string): boolean {
  if (!reason) return false;
  if (reason !== 'other') return true;
  const trimmed = reasonText.trim();
  return trimmed.length > 0 && trimmed.length <= REASON_TEXT_MAX;
}

export function RejectReasonForm({ open, onCancel, onConfirm }: RejectReasonFormProps) {
  const [reason, setReason] = useState<RejectReason>();
  const [reasonText, setReasonText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setReason(undefined);
    setReasonText('');
    setError(undefined);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = async () => {
    if (!isValid(reason, reasonText)) return;
    setSending(true);
    setError(undefined);
    try {
      await onConfirm({
        reason: reason!,
        ...(reason === 'other' ? { reasonText: reasonText.trim() } : {}),
      });
      reset();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.requestId ? `（問い合わせ番号: ${err.requestId}）` : ''}`
          : '却下できませんでした。',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleCancel} fullWidth maxWidth="sm">
      <DialogTitle>却下の理由</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <BigChoice<RejectReason>
          label="理由を選んでください"
          name="reject-reason"
          options={REJECT_REASON_OPTIONS}
          value={reason}
          onChange={setReason}
        />
        {reason === 'other' && (
          <Stack spacing={1}>
            <TextField
              label="理由（ハンターに表示されます）"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              multiline
              minRows={2}
              inputProps={{ 'data-testid': 'reject-reason-text', maxLength: REASON_TEXT_MAX + 50 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              data-testid="reject-reason-remaining"
            >
              残り {Math.max(0, REASON_TEXT_MAX - reasonText.trim().length)} 文字
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} data-testid="reject-cancel">
          やめる
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={sending || !isValid(reason, reasonText)}
          onClick={handleConfirm}
          data-testid="reject-confirm"
        >
          却下を確定する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
