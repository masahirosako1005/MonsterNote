// ルートの Vitest の設定。カバレッジはプロジェクト全体で測る（team.md・NFR13.1）。
// 対象は自分で書いた画面と API のロジック。CDK（infra）は割合の対象から外し、構成の試験で確かめる。
// 行カバレッジ 80% の床は下げない。
import { defineConfig } from 'vitest/config';
import projects from './vitest.workspace';

export default defineConfig({
  test: {
    projects,
    coverage: {
      provider: 'v8',
      include: ['backend/src/**/*.{ts,tsx}', 'frontend/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        // 画面の起動だけを行う入口（ブラウザで動かして E2E で確かめる）
        'frontend/*/src/main.tsx',
      ],
      reporter: ['text-summary', 'text', 'json-summary'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
