// 報告の作成のステップの見出し（「n/3」、戻る、やめる。interaction-spec）
import { Box, Button, Typography } from '@mui/material';

export interface StepHeaderProps {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
  onCancel: () => void;
}

export function StepHeader({ step, total, title, onBack, onCancel }: StepHeaderProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        {onBack ? (
          <Button variant="text" onClick={onBack} data-testid="step-back">
            戻る
          </Button>
        ) : (
          <span />
        )}
        <Button variant="text" color="error" onClick={onCancel} data-testid="step-cancel">
          やめる
        </Button>
      </Box>
      <Typography component="p" data-testid="step-count">
        {step}/{total}
      </Typography>
      <Typography component="h1" variant="h5">
        {title}
      </Typography>
    </Box>
  );
}
