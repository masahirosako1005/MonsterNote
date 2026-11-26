// A5 設定（重複の基準・対象地域。BR9.2）。範囲を外れると項目ごとに理由を出す。
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

export interface SettingsFormValues {
  duplicateDistanceMeters: number;
  duplicateWindowHours: number;
  targetAreaNorth: number;
  targetAreaSouth: number;
  targetAreaEast: number;
  targetAreaWest: number;
}

export function validateSettingsForm(
  v: SettingsFormValues,
): Partial<Record<keyof SettingsFormValues, string>> {
  const errors: Partial<Record<keyof SettingsFormValues, string>> = {};
  if (!(v.duplicateDistanceMeters >= 1))
    errors.duplicateDistanceMeters = '1 m 以上を入れてください';
  if (!(v.duplicateWindowHours >= 1)) errors.duplicateWindowHours = '1 時間以上を入れてください';
  if (!(v.targetAreaNorth > v.targetAreaSouth))
    errors.targetAreaNorth = '南より大きい値を入れてください';
  if (!(v.targetAreaEast > v.targetAreaWest))
    errors.targetAreaEast = '西より大きい値を入れてください';
  return errors;
}

export interface SettingsFormProps {
  initial: SettingsFormValues;
  onSubmit: (values: SettingsFormValues) => Promise<void>;
}

const FIELDS: { key: keyof SettingsFormValues; label: string }[] = [
  { key: 'duplicateDistanceMeters', label: '重複とみなす距離（m）' },
  { key: 'duplicateWindowHours', label: '重複とみなす時間（時間）' },
  { key: 'targetAreaNorth', label: '対象地域: 北（緯度）' },
  { key: 'targetAreaSouth', label: '対象地域: 南（緯度）' },
  { key: 'targetAreaEast', label: '対象地域: 東（経度）' },
  { key: 'targetAreaWest', label: '対象地域: 西（経度）' },
];

export function SettingsForm({ initial, onSubmit }: SettingsFormProps) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const errors = validateSettingsForm(values);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setSaved(false);
    if (Object.keys(errors).length > 0) return;
    setSending(true);
    setError(undefined);
    try {
      await onSubmit(values);
      setSaved(true);
    } catch {
      setError('保存できませんでした');
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
          設定
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {saved && <Alert severity="success">保存しました</Alert>}
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
            error={touched && Boolean(errors[key])}
            helperText={(touched && errors[key]) || ' '}
            slotProps={{ htmlInput: { 'data-testid': `settings-${key}` } }}
          />
        ))}
        <Button type="submit" variant="contained" disabled={sending} data-testid="settings-save">
          保存
        </Button>
      </Stack>
    </Box>
  );
}
