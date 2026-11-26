// 初回の手続き: 利用の同意（BR11.5。Q4）。「同意しない」は報告できない旨と「管理者にご連絡ください」。
import { useState } from 'react';
import { Alert, Box, Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';

export interface ConsentPanelProps {
  onDecide: (consented: boolean) => Promise<void>;
}

export function ConsentPanel({ onDecide }: ConsentPanelProps) {
  const [declined, setDeclined] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const decide = async (consented: boolean) => {
    setSending(true);
    setError(undefined);
    try {
      await onDecide(consented);
      if (!consented) setDeclined(true);
    } catch {
      setError('記録できませんでした');
    } finally {
      setSending(false);
    }
  };

  if (declined) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
        <Alert severity="info" data-testid="consent-declined-message">
          報告を作ることはできません。管理者にご連絡ください
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
      <Stack spacing={2}>
        <Typography component="h1" variant="h5">
          ご利用にあたっての同意
        </Typography>
        <Typography>
          報告を送ると、以下の内容が依頼元（市区町村・猟友会）に見えるようになります
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText primary="捕獲した場所・日時" />
          </ListItem>
          <ListItem>
            <ListItemText primary="捕獲従事者番号" />
          </ListItem>
          <ListItem>
            <ListItemText primary="撮影した写真" />
          </ListItem>
        </List>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            disabled={sending}
            onClick={() => void decide(true)}
            data-testid="consent-agree"
          >
            同意する
          </Button>
          <Button
            variant="outlined"
            disabled={sending}
            onClick={() => void decide(false)}
            data-testid="consent-decline"
          >
            同意しない
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
