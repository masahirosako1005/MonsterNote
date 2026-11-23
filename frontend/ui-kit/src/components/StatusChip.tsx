// 状態の印（文字とアイコン。色だけで伝えない）
import { Chip } from '@mui/material';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { STATUS_LABELS, type ReportStatus } from '../labels';

const ICONS = {
  checking: <HourglassTopIcon />,
  approved: <CheckCircleIcon />,
  rejected: <CancelIcon />,
};
const COLORS = { checking: 'default', approved: 'success', rejected: 'error' } as const;

export function StatusChip({ status }: { status: ReportStatus }) {
  return (
    <Chip
      icon={ICONS[status]}
      label={STATUS_LABELS[status]}
      color={COLORS[status]}
      variant={status === 'checking' ? 'outlined' : 'filled'}
      data-testid={`status-${status}`}
    />
  );
}
