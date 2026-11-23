// ログインの部品（H1・R1。BR1.1）。失敗のとき、入れた ID は残す。
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

export interface LoginFormProps {
  title: string;
  onSubmit: (loginId: string, password: string) => Promise<void>;
}

export function LoginForm({ title, onSubmit }: LoginFormProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!loginId || !password) return;
    setSending(true);
    setError(undefined);
    try {
      await onSubmit(loginId, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインできませんでした');
      setPassword('');
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
          {title}
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="ID"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
          error={touched && !loginId}
          helperText={touched && !loginId ? '入れてください' : ' '}
          slotProps={{ htmlInput: { 'data-testid': 'login-id' } }}
        />
        <TextField
          label="パスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={touched && !password}
          helperText={touched && !password ? '入れてください' : ' '}
          slotProps={{ htmlInput: { 'data-testid': 'login-password' } }}
        />
        <Button type="submit" variant="contained" disabled={sending} data-testid="login-submit">
          ログイン
        </Button>
      </Stack>
    </Box>
  );
}
