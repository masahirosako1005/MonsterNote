// 報告の一覧（H2・R2。BR4.2・BR4.3・BR4.4）。新しい順・50 件・次のページ・空の表示・状態の印。
import { Box, Button, List, ListItemButton, ListItem, Stack, Typography } from '@mui/material';
import { StatusChip } from './StatusChip';
import { formatDate, speciesLabel, type ReportStatus } from '../labels';

export interface ReportListRow {
  reportId: string;
  hunterName?: string;
  species?: string;
  capturedAt?: string;
  submittedAt?: string;
  status: ReportStatus;
  /** 送信したばかりで、まだ一覧に届いていない行（画面が仮に出す） */
  pending?: boolean;
}

export interface ReportListProps {
  rows: ReportListRow[];
  emptyText: string;
  totalCount?: number;
  hasNext?: boolean;
  onNext?: () => void;
  onSelect?: (reportId: string) => void;
  showHunterName?: boolean;
}

function RowContent({ row, showHunterName }: { row: ReportListRow; showHunterName: boolean }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography>{formatDate(row.capturedAt ?? row.submittedAt)}</Typography>
        <Typography>{speciesLabel(row.species)}</Typography>
        {showHunterName && row.hunterName && <Typography>{row.hunterName}</Typography>}
      </Box>
      <StatusChip status={row.status} />
    </Stack>
  );
}

export function ReportList({
  rows,
  emptyText,
  totalCount,
  hasNext,
  onNext,
  onSelect,
  showHunterName = false,
}: ReportListProps) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ p: 2 }} data-testid="report-list-empty">
        {emptyText}
      </Typography>
    );
  }
  return (
    <Box>
      {totalCount !== undefined && (
        <Typography sx={{ px: 2 }} data-testid="report-list-total">
          全 {totalCount} 件
        </Typography>
      )}
      <List>
        {rows.map((row) =>
          onSelect ? (
            <ListItemButton
              key={row.reportId}
              divider
              onClick={() => onSelect(row.reportId)}
              data-testid="report-row"
            >
              <RowContent row={row} showHunterName={showHunterName} />
            </ListItemButton>
          ) : (
            <ListItem key={row.reportId} divider data-testid="report-row">
              <RowContent row={row} showHunterName={showHunterName} />
            </ListItem>
          ),
        )}
      </List>
      {hasNext && (
        <Button variant="outlined" fullWidth onClick={onNext} data-testid="report-list-next">
          次の 50 件
        </Button>
      )}
    </Box>
  );
}
