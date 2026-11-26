// 初回の手続き: パスワードの変更（BR11.4）。8文字以上・英字と数字を含むまで確定できない。
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export interface PasswordChangeFormProps {
  onSubmit: (password: string) => Promise<void>;
}

export function PasswordChangeForm({ onSubmit }: PasswordChangeFormProps) {
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const valid = isValidPassword(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setSending(true);
    setError(undefined);
    try {
      await onSubmit(password);
    } catch {
      setError('パスワードを変更できませんでした');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit}
      sx={{ maxWidth: 480, mx: 'auto', p: 2 }}
    >
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          パスワードの変更
        </Typography>
        <Typography>はじめてログインしたので、新しいパスワードを決めてください</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="新しいパスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={touched && !valid}
          helperText={touched && !valid ? '8 文字以上で、英字と数字を含めてください' : ' '}
          slotProps={{ htmlInput: { 'data-testid': 'new-password' } }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={sending || (touched && !valid)}
          data-testid="password-change-submit"
        >
          変更する
        </Button>
      </Stack>
    </Box>
  );
}
