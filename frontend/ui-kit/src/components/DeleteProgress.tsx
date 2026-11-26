// A9 削除の進み具合（BR13.1）。部品ごとに待ち・実行中・終わった・失敗を表示。失敗した部品からやり直せる。
// 画面が状態を持つだけで、サーバーは進み具合を覚えない（やり直すときは最初から押し直す）。
import type { ReactNode } from 'react';
import { Alert, Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import PendingIcon from '@mui/icons-material/Pending';

export type DeleteStepStatus = 'waiting' | 'running' | 'done' | 'failed';

export interface DeleteProgressStep {
  key: string;
  label: string;
  status: DeleteStepStatus;
  deletedCount?: number;
}

const STEP_ICONS: Record<DeleteStepStatus, ReactNode> = {
  waiting: <PendingIcon color="disabled" />,
  running: <HourglassTopIcon color="action" />,
  done: <CheckCircleIcon color="success" />,
  failed: <ErrorIcon color="error" />,
};
const STEP_LABELS: Record<DeleteStepStatus, string> = {
  waiting: '待ち',
  running: '実行中',
  done: '終わった',
  failed: '失敗した',
};

export interface DeleteProgressProps {
  steps: DeleteProgressStep[];
  onRetry: (key: string) => void;
  /** 5つが終わったあとの数え直しで0件でなければ表示する（AC6.5.2） */
  recheckMessage?: string;
}

export function DeleteProgress({ steps, onRetry, recheckMessage }: DeleteProgressProps) {
  return (
    <Stack spacing={2} sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
      <Typography component="h1" variant="h5">
        削除の進み具合
      </Typography>
      <List data-testid="delete-progress-list">
        {steps.map((step) => (
          <ListItem
            key={step.key}
            divider
            secondaryAction={
              step.status === 'failed' ? (
                <Button
                  size="small"
                  onClick={() => onRetry(step.key)}
                  data-testid={`delete-retry-${step.key}`}
                >
                  やり直す
                </Button>
              ) : undefined
            }
          >
            {STEP_ICONS[step.status]}
            <ListItemText
              sx={{ ml: 1 }}
              primary={step.label}
              secondary={`${STEP_LABELS[step.status]}${
                step.status === 'done' && step.deletedCount !== undefined
                  ? `（${step.deletedCount}件）`
                  : ''
              }`}
              data-testid={`delete-step-${step.key}`}
            />
          </ListItem>
        ))}
      </List>
      {recheckMessage && (
        <Alert severity="warning" data-testid="delete-recheck-message">
          {recheckMessage}
        </Alert>
      )}
    </Stack>
  );
}
