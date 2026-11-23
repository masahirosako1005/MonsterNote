// 画面の部品と画面の流れの試験（jsdom ＋ Testing Library ＋ msw）
import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      '@ui-kit': fileURLToPath(new URL('./ui-kit/src', import.meta.url)),
    },
  },
  test: {
    name: 'frontend',
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15_000,
  },
});
