// A4 仮のパスワードの表示（BR11.3）。1回だけ、画面を閉じると二度と見られない。写しやすい区切り付きの形。
import { Alert, Box, Button, Stack, Typography } from '@mui/material';

/** 4文字ごとに「-」を挟む（例: ab3d-ef7g-hk2m。NFR7.8） */
export function formatForDisplay(password: string): string {
  return password.match(/.{1,4}/g)?.join('-') ?? password;
}

export interface TempPasswordPanelProps {
  loginId: string;
  temporaryPassword: string;
  onClose: () => void;
}

export function TempPasswordPanel({ loginId, temporaryPassword, onClose }: TempPasswordPanelProps) {
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          仮のパスワード
        </Typography>
        <Alert severity="warning">
          この画面を閉じると、仮のパスワードは二度と表示されません。アプリの外で本人に渡してください
        </Alert>
        <Typography>ID: {loginId}</Typography>
        <Typography
          variant="h6"
          component="p"
          sx={{ fontFamily: 'monospace', letterSpacing: 2 }}
          data-testid="temp-password"
        >
          {formatForDisplay(temporaryPassword)}
        </Typography>
        <Button variant="contained" onClick={onClose} data-testid="temp-password-close">
          閉じる
        </Button>
      </Stack>
    </Box>
  );
}
