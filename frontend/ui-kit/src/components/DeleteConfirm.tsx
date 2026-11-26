// A8 削除の確認（BR13.2）。件数つき。取り返しのつかない操作のため「削除する」は目立たせない。
import { Alert, Box, Button, Stack, Typography } from '@mui/material';

export interface DeleteConfirmProps {
  reportCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ reportCount, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          試験運用の終わりの削除
        </Typography>
        <Alert severity="warning">この操作は取り消せません</Alert>
        <Typography variant="h3" component="p" data-testid="delete-confirm-count">
          報告 {reportCount} 件と写真を削除します。よろしいですか？
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={onCancel} data-testid="delete-cancel">
            やめる
          </Button>
          <Button variant="outlined" color="error" onClick={onConfirm} data-testid="delete-confirm">
            削除する
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
