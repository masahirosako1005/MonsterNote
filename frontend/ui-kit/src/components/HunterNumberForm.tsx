// 初回の手続き: 従事者番号の登録（BR11.6）。数字1〜20桁。空では登録できない。
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

export function isValidHunterNumber(value: string): boolean {
  return /^[0-9]{1,20}$/.test(value);
}

export interface HunterNumberFormProps {
  onSubmit: (hunterNumber: string) => Promise<void>;
}

export function HunterNumberForm({ onSubmit }: HunterNumberFormProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const valid = isValidHunterNumber(value);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setSending(true);
    setError(undefined);
    try {
      await onSubmit(value);
    } catch {
      setError('登録できませんでした');
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
          捕獲従事者番号の登録
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="捕獲従事者番号"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={touched && !valid}
          helperText={touched && !valid ? '番号を入れてください' : ' '}
          slotProps={{ htmlInput: { 'data-testid': 'hunter-number-input' } }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={sending || (touched && !valid)}
          data-testid="hunter-number-submit"
        >
          登録する
        </Button>
      </Stack>
    </Box>
  );
}
