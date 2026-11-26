// A1 アカウントの一覧（BR11.1・BR11.9）。自分自身と最後の管理者には無効化のボタンを出さない。
import { Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { accountRoleLabel, ACCOUNT_STATUS_LABELS } from '../labels';

export interface AccountTableRow {
  accountId: string;
  loginId: string;
  displayName: string;
  role: 'hunter' | 'requester' | 'admin';
  status: 'active' | 'disabled';
}

export interface AccountTableProps {
  rows: AccountTableRow[];
  onSelect: (accountId: string) => void;
}

/** 有効な管理者が1人だけのとき、その管理者には無効化のボタンを出さない（UI側の補助。サーバーも確かめる） */
function activeAdminCountOf(rows: AccountTableRow[]): number {
  return rows.filter((r) => r.role === 'admin' && r.status === 'active').length;
}

export function canShowDisable(
  row: AccountTableRow,
  selfAccountId: string,
  rows: AccountTableRow[],
): boolean {
  if (row.status !== 'active') return false;
  if (row.accountId === selfAccountId) return false;
  if (row.role === 'admin' && activeAdminCountOf(rows) <= 1) return false;
  return true;
}

export function AccountTable({ rows, onSelect }: AccountTableProps) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ p: 2 }} data-testid="account-table-empty">
        アカウントがありません
      </Typography>
    );
  }
  return (
    <List data-testid="account-table">
      {rows.map((row) => (
        <ListItem
          key={row.accountId}
          divider
          secondaryAction={
            <Button
              size="small"
              onClick={() => onSelect(row.accountId)}
              data-testid="account-detail-button"
            >
              詳細
            </Button>
          }
        >
          <ListItemText
            primary={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography component="span">{row.displayName}</Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  （{row.loginId}）
                </Typography>
              </Stack>
            }
            secondary={`${accountRoleLabel(row.role)}・${ACCOUNT_STATUS_LABELS[row.status]}`}
          />
        </ListItem>
      ))}
    </List>
  );
}
