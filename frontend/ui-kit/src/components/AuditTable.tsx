// A6 操作の記録（BR12.1・BR12.3・AC6.6.3）。新しい順・50件・次のページ。利用者のIDは出さない。
import { Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { auditActionLabel, formatDateTime } from '../labels';

export interface AuditEntryRow {
  entryId: string;
  occurredAt: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'succeeded' | 'failed';
}

export interface AuditTableProps {
  rows: AuditEntryRow[];
  hasNext: boolean;
  onNext: () => void;
}

export function AuditTable({ rows, hasNext, onNext }: AuditTableProps) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ p: 2 }} data-testid="audit-table-empty">
        記録はまだありません
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      <List data-testid="audit-table">
        {rows.map((row) => (
          <ListItem key={row.entryId} divider>
            <ListItemText
              primary={`${formatDateTime(row.occurredAt)} ${auditActionLabel(row.action)}`}
              secondary={`操作した人: ${row.actorName ?? '仕組み'}／対象: ${row.targetId ?? '—'}／結果: ${
                row.outcome === 'succeeded' ? '成功' : '失敗'
              }`}
            />
          </ListItem>
        ))}
      </List>
      {hasNext && (
        <Button variant="text" onClick={onNext} data-testid="audit-table-next">
          次の50件
        </Button>
      )}
    </Stack>
  );
}
