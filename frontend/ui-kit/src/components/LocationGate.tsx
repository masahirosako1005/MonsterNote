// 位置の取得（送信の画面。BR2.5）。取れなければ許可の手順を表示し、送れなくする（画面の送るボタンは位置が取れるまで押せない）。
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function browserPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

export interface LocationGateProps {
  onLocation: (point: GeoPoint) => void;
  getPosition?: () => Promise<GeoPoint>;
}

type State = 'pending' | 'ok' | 'denied';

export function LocationGate({ onLocation, getPosition = browserPosition }: LocationGateProps) {
  const [state, setState] = useState<State>('pending');
  // 「もう一度」を押すたびに増やし、位置を取り直す
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    // 状態は位置が取れた・取れなかったあとに書き換える（効果の中で同期的に setState しない）
    getPosition().then(
      (point) => {
        if (!active) return;
        setState('ok');
        onLocation(point);
      },
      () => {
        if (active) setState('denied');
      },
    );
    return () => {
      active = false;
    };
  }, [getPosition, onLocation, attempt]);

  const locate = () => {
    setState('pending');
    setAttempt((n) => n + 1);
  };

  if (state === 'pending') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="location-pending">
        <CircularProgress size={24} />
        <Typography>位置を確かめています</Typography>
      </Box>
    );
  }
  if (state === 'ok') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="location-ok">
        <PlaceIcon color="success" />
        <Typography>位置を確かめました</Typography>
      </Box>
    );
  }
  return (
    <Alert severity="warning" data-testid="location-denied">
      <Typography>位置が分からないため、まだ送れません。</Typography>
      <Typography>
        スマホの設定で、このページの位置情報の利用を許可してから「もう一度」を押してください。
      </Typography>
      <Button variant="outlined" onClick={locate} sx={{ mt: 1 }} data-testid="location-retry">
        もう一度
      </Button>
    </Alert>
  );
}
