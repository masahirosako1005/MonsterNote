// 「送ってから n 日」と「7 日以上」の印（R2・H2。BR4.9・AC5.3.2）。確認済みには出さない。
// 日数は一覧の応答（daysSinceSubmitted・waitingOverSevenDays。status=checking のときだけ付く）をそのまま表示する。
import { Chip, Stack, Typography } from '@mui/material';

export interface WaitingDaysProps {
  daysSinceSubmitted?: number;
  waitingOverSevenDays?: boolean;
  /** badge: 依頼元の一覧の印。message: ハンターの一覧の文章（AC5.3.2） */
  variant?: 'badge' | 'message';
}

export function WaitingDays({
  daysSinceSubmitted,
  waitingOverSevenDays,
  variant = 'badge',
}: WaitingDaysProps) {
  if (daysSinceSubmitted === undefined) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="center" data-testid="waiting-days">
      <Typography variant="caption">送ってから {daysSinceSubmitted} 日</Typography>
      {waitingOverSevenDays &&
        (variant === 'badge' ? (
          <Chip size="small" color="warning" label="7 日以上" data-testid="waiting-over-seven" />
        ) : (
          <Typography
            variant="caption"
            color="warning.main"
            data-testid="waiting-over-seven-message"
          >
            依頼元の確認に時間がかかっています。急ぐときは依頼元に連絡してください
          </Typography>
        ))}
    </Stack>
  );
}
