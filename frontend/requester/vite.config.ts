// 依頼元用の画面（RequesterApp）の Vite の設定
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { '@ui-kit': fileURLToPath(new URL('../ui-kit/src', import.meta.url)) },
  },
  // 対応するブラウザ（Safari・Chrome・Edge の最新と 1 つ前。NFR9.1）
  build: { outDir: 'dist', emptyOutDir: true, target: ['safari17', 'chrome120', 'edge120'] },
  // 同じ PC のほかのプロジェクト（Vite の既定 5173・5174）とぶつからない番号にする
  server: { port: 5274, strictPort: true },
  preview: { port: 5274, strictPort: true },
});
