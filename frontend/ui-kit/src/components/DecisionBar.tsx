// 承認のボタン（R3。BR3.3・BR3.6・BR3.7）。U1 は「承認」だけ。確認済みなら出さない。
import { useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { ApiError } from '../api/client';
import { STATUS_LABELS, type ReportStatus } from '../labels';

export interface DecisionBarProps {
  status: ReportStatus;
  onApprove: () => Promise<void>;
  /** 承認できた・すでに確認済みだったとき、画面の状態を最新にする */
  onDecided: () => void;
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'ALREADY_DECIDED') {
      const decision = STATUS_LABELS[(err.conflict?.decision as ReportStatus) ?? 'approved'];
      const by =
        typeof err.conflict?.decidedByName === 'string' ? `、${err.conflict.decidedByName}` : '';
      return `すでに確認済みです（${decision}${by}）`;
    }
    if (err.code === 'REVIEW_NOT_READY') return err.message;
    return `承認できませんでした。${err.requestId ? `（問い合わせ番号: ${err.requestId}）` : ''}`;
  }
  return '承認できませんでした。';
}

export function DecisionBar({ status, onApprove, onDecided }: DecisionBarProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  if (status !== 'checking') return null;

  const approve = async () => {
    setSending(true);
    setError(undefined);
    try {
      await onApprove();
      onDecided();
    } catch (err) {
      setError(messageOf(err));
      if (err instanceof ApiError && err.code === 'ALREADY_DECIDED') onDecided();
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Button
        variant="contained"
        color="success"
        disabled={sending}
        onClick={approve}
        data-testid="approve-button"
      >
        承認
      </Button>
    </Box>
  );
}
