// 報告の一覧（H2・R2。BR4.2・BR4.3・BR4.4）。新しい順・50 件・次のページ・空の表示・状態の印。
// U3: 絞り込みの印（重複の疑い・手入力）、日数（WaitingDays）、緯度・経度（placeName が空のとき）、
// 読む上限に達した全件数（2,000 件以上。ListPager）を足す。
import { Box, Chip, List, ListItemButton, ListItem, Stack, Typography } from '@mui/material';
import { ListPager } from './ListPager';
import { StatusChip } from './StatusChip';
import { WaitingDays } from './WaitingDays';
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
  // U3
  placeName?: string | null;
  location?: { lat: number; lng: number };
  duplicateSuspected?: boolean;
  manualEntry?: boolean;
  daysSinceSubmitted?: number;
  waitingOverSevenDays?: boolean;
}

export interface ReportListProps {
  rows: ReportListRow[];
  emptyText: string;
  totalCount?: number;
  totalCountHasMore?: boolean;
  hasNext?: boolean;
  onNext?: () => void;
  onSelect?: (reportId: string) => void;
  showHunterName?: boolean;
  /** 依頼元の一覧は印（badge）、ハンターの一覧は文章（message）。既定は badge */
  waitingDaysVariant?: 'badge' | 'message';
}

function RowContent({
  row,
  showHunterName,
  waitingDaysVariant,
}: {
  row: ReportListRow;
  showHunterName: boolean;
  waitingDaysVariant: 'badge' | 'message';
}) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography>{formatDate(row.capturedAt ?? row.submittedAt)}</Typography>
        <Typography>{speciesLabel(row.species)}</Typography>
        {showHunterName && row.hunterName && <Typography>{row.hunterName}</Typography>}
        {!row.placeName && row.location && (
          <Typography variant="caption" data-testid="report-row-location">
            {row.location.lat.toFixed(5)}, {row.location.lng.toFixed(5)}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          {row.duplicateSuspected && (
            <Chip size="small" color="warning" label="重複の疑い" data-testid="duplicate-flag" />
          )}
          {row.manualEntry && (
            <Chip size="small" color="info" label="手入力" data-testid="manual-flag" />
          )}
        </Stack>
        <WaitingDays
          daysSinceSubmitted={row.daysSinceSubmitted}
          waitingOverSevenDays={row.waitingOverSevenDays}
          variant={waitingDaysVariant}
        />
      </Box>
      <StatusChip status={row.status} />
    </Stack>
  );
}

export function ReportList({
  rows,
  emptyText,
  totalCount,
  totalCountHasMore,
  hasNext,
  onNext,
  onSelect,
  showHunterName = false,
  waitingDaysVariant = 'badge',
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
      <ListPager totalCount={totalCount} totalCountHasMore={totalCountHasMore} hasNext={false} />
      <List>
        {rows.map((row) =>
          onSelect ? (
            <ListItemButton
              key={row.reportId}
              divider
              onClick={() => onSelect(row.reportId)}
              data-testid="report-row"
            >
              <RowContent
                row={row}
                showHunterName={showHunterName}
                waitingDaysVariant={waitingDaysVariant}
              />
            </ListItemButton>
          ) : (
            <ListItem key={row.reportId} divider data-testid="report-row">
              <RowContent
                row={row}
                showHunterName={showHunterName}
                waitingDaysVariant={waitingDaysVariant}
              />
            </ListItem>
          ),
        )}
      </List>
      <ListPager hasNext={hasNext} onNext={onNext} />
    </Box>
  );
}
