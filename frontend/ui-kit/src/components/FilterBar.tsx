// 一覧の絞り込み（R2。BR4.5、NFR7.6）。状態 3 つ・印 2 つ、複数選べるトグルボタン。選んだ条件を消せる。
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import {
  FILTER_FLAG_OPTIONS,
  FILTER_STATUS_OPTIONS,
  type FilterFlag,
  type ReportStatus,
} from '../labels';

export interface FilterBarValue {
  status: ReportStatus[];
  flag: FilterFlag[];
}

export interface FilterBarProps {
  value: FilterBarValue;
  onChange: (value: FilterBarValue) => void;
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  const hasFilter = value.status.length > 0 || value.flag.length > 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack spacing={1}>
        <Box>
          <Typography variant="caption" component="p">
            状態で絞り込む
          </Typography>
          <ToggleButtonGroup
            value={value.status}
            onChange={(_, next: ReportStatus[]) => onChange({ ...value, status: next })}
            aria-label="状態で絞り込む"
            size="small"
          >
            {FILTER_STATUS_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value} data-testid={`filter-status-${o.value}`}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="caption" component="p">
            印で絞り込む
          </Typography>
          <ToggleButtonGroup
            value={value.flag}
            onChange={(_, next: FilterFlag[]) => onChange({ ...value, flag: next })}
            aria-label="印で絞り込む"
            size="small"
          >
            {FILTER_FLAG_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value} data-testid={`filter-flag-${o.value}`}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        {hasFilter && (
          <Button
            variant="text"
            size="small"
            onClick={() => onChange({ status: [], flag: [] })}
            data-testid="filter-clear"
            sx={{ alignSelf: 'flex-start' }}
          >
            条件を消す
          </Button>
        )}
      </Stack>
    </Box>
  );
}
