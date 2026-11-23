// ハンター用の画面の起動: 実行時の設定（config.json）を読んでから画面を出す
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConfig } from '@ui-kit/config';
import { HunterApp } from './App';

const root = createRoot(document.getElementById('root')!);

loadConfig()
  .then((config) =>
    root.render(
      <StrictMode>
        <HunterApp config={config} />
      </StrictMode>,
    ),
  )
  .catch((err: unknown) => {
    // 設定が読めないと何もできないため、理由を文字で出す
    root.render(<p role="alert">{err instanceof Error ? err.message : '起動できませんでした'}</p>);
  });
