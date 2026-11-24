// 判別待ちのタイムアウト処理の共通化（NFR7.4）。active な間だけ時間をはかり、
// timeoutMs たつと true になる。active が false に戻ると状態もリセットされる。
import { useEffect, useState } from 'react';

export function useTimeout(active: boolean, timeoutMs: number): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    // 後片付けで戻す（次に active になったときのために。effect の本体で直接 setState しない）
    return () => {
      clearTimeout(timer);
      setTimedOut(false);
    };
  }, [active, timeoutMs]);

  // active でない間は、前回の結果が残っていても false として返す
  return active && timedOut;
}
