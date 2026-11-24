// 種類の自動判別を待つ間の表示（BR6.2〜BR6.4）。3 秒たっても待っていれば、
// 「判別できませんでした。手で選んでください」に切り替える（NFR7.4）。
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useTimeout } from '../hooks/useTimeout';

export const DETECTION_WAIT_TIMEOUT_MS = 3_000;

export interface DetectionWaitProps {
  /** 判別の応答をまだ待っているか */
  active: boolean;
  timeoutMs?: number;
}

export function DetectionWait({
  active,
  timeoutMs = DETECTION_WAIT_TIMEOUT_MS,
}: DetectionWaitProps) {
  const timedOut = useTimeout(active, timeoutMs);
  if (!active) return null;
  if (timedOut) {
    return (
      <Alert severity="info" data-testid="detection-timeout">
        判別できませんでした。手で選んでください
      </Alert>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="detection-waiting">
      <CircularProgress size={24} />
      <Typography>判別しています</Typography>
    </Box>
  );
}
