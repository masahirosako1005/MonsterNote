// 送るボタン（BR2.6、AC2.1.2・AC2.1.3）。送信中は押せず「確認しています」、失敗で「送れませんでした」と「もう一度」。
import { Alert, Box, Button } from '@mui/material';

export type SubmitState = 'idle' | 'sending' | 'failed';

export interface SubmitButtonProps {
  state: SubmitState;
  onSubmit: () => void;
  disabled?: boolean;
  /** 失敗のときに出す問い合わせ番号 */
  requestId?: string;
  errorMessage?: string;
}

export function SubmitButton({
  state,
  onSubmit,
  disabled,
  requestId,
  errorMessage,
}: SubmitButtonProps) {
  const label = state === 'sending' ? '確認しています' : state === 'failed' ? 'もう一度' : '送る';
  return (
    <Box>
      {state === 'failed' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          送れませんでした。{errorMessage ? `${errorMessage}。` : ''}選んだ内容は残っています。
          {requestId ? `（問い合わせ番号: ${requestId}）` : ''}
        </Alert>
      )}
      <Button
        variant="contained"
        fullWidth
        disabled={disabled || state === 'sending'}
        onClick={onSubmit}
        data-testid="submit-report"
      >
        {label}
      </Button>
    </Box>
  );
}
