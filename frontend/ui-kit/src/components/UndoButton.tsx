// 取り消すボタン（R3。BR3.9・BR3.15、NFR7.5）。サーバーから受け取った絶対時刻（undoUntil）と
// 受け取った時点の Date.now() の差からカウントダウンし、以後はタイマーだけで再計算する（再度サーバーに問い合わせない）。
// 0 になったら消える。同時操作で弾かれた（ALREADY_UNDONE・UNDO_EXPIRED）場合は、呼び出し側（onUndo）が
// すでに吸収して状態を出し直す前提のため、ここではエラー表示にしない（NFR7.7）。
import { useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { ApiError } from '../api/client';

export interface UndoButtonProps {
  /** 取り消せる期限（サーバーの絶対時刻、ISO） */
  undoUntil: string;
  onUndo: () => Promise<void>;
  /** 試験用の時計（既定は Date.now）。1 秒ごとに再計算するタイマーもこれを使う */
  now?: () => number;
}

export function UndoButton({ undoUntil, onUndo, now = () => Date.now() }: UndoButtonProps) {
  const deadline = new Date(undoUntil).getTime();
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline - now()));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  // deadline（undoUntil）が変わるときは、呼び出し側が key を変えて作り直す前提（初期値は useState の
  // 遅延初期化で計算済みのため、ここでは 1 秒ごとの再計算だけを行う）
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - now()));
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  if (remainingMs <= 0) return null;
  const seconds = Math.ceil(remainingMs / 1000);

  const handleClick = async () => {
    setSending(true);
    setError(undefined);
    try {
      await onUndo();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `取り消せませんでした。${err.requestId ? `（問い合わせ番号: ${err.requestId}）` : ''}`
          : '取り消せませんでした。',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ mt: 1 }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Button
        variant="outlined"
        color="warning"
        disabled={sending}
        onClick={handleClick}
        data-testid="undo-button"
      >
        取り消す（残り {seconds} 秒）
      </Button>
    </Box>
  );
}
