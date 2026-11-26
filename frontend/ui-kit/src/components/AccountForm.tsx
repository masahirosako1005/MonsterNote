// A2 アカウントの作成（BR11.2）。役割・表示名・ID。依頼元は所属も必須。IDが重なると拒む。
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import {
  ACCOUNT_ROLE_OPTIONS,
  ORGANIZATION_OPTIONS,
  type AccountRole,
  type Organization,
} from '../labels';

export interface AccountFormInput {
  role: AccountRole;
  loginId: string;
  displayName: string;
  organization?: Organization;
}

export interface AccountFormProps {
  onSubmit: (input: AccountFormInput) => Promise<void>;
}

function validate(input: Partial<AccountFormInput>): string[] {
  const errors: string[] = [];
  if (!input.role) errors.push('role');
  if (!input.loginId || !/^[A-Za-z0-9]{3,32}$/.test(input.loginId)) errors.push('loginId');
  if (!input.displayName || input.displayName.length < 1 || input.displayName.length > 50) {
    errors.push('displayName');
  }
  if (input.role === 'requester' && !input.organization) errors.push('organization');
  return errors;
}

export function AccountForm({ onSubmit }: AccountFormProps) {
  const [role, setRole] = useState<AccountRole>('hunter');
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState<Organization | ''>('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const input: Partial<AccountFormInput> = {
    role,
    loginId,
    displayName,
    organization: organization || undefined,
  };
  const errors = validate(input);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.length > 0) return;
    setSending(true);
    setError(undefined);
    try {
      await onSubmit(input as AccountFormInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'この ID は使われています');
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
          アカウントの作成
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          select
          label="役割"
          value={role}
          onChange={(e) => setRole(e.target.value as AccountRole)}
          slotProps={{ htmlInput: { 'data-testid': 'account-role' } }}
        >
          {ACCOUNT_ROLE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        {role === 'requester' && (
          <TextField
            select
            label="所属"
            value={organization}
            onChange={(e) => setOrganization(e.target.value as Organization)}
            error={touched && errors.includes('organization')}
            helperText={touched && errors.includes('organization') ? '所属を選んでください' : ' '}
            slotProps={{ htmlInput: { 'data-testid': 'account-organization' } }}
          >
            {ORGANIZATION_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          label="表示名"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={touched && errors.includes('displayName')}
          helperText={touched && errors.includes('displayName') ? '1〜50文字で入れてください' : ' '}
          slotProps={{ htmlInput: { 'data-testid': 'account-display-name' } }}
        />
        <TextField
          label="ID"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          error={touched && errors.includes('loginId')}
          helperText={
            touched && errors.includes('loginId') ? '英数字3〜32文字で入れてください' : ' '
          }
          slotProps={{ htmlInput: { 'data-testid': 'account-login-id' } }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={sending}
          data-testid="account-form-submit"
        >
          作成
        </Button>
      </Stack>
    </Box>
  );
}
