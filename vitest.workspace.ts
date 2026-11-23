// Vitest の 3 つのプロジェクト: backend（関数とスクリプト）・frontend（画面）・infra（CDK の構成の試験）。
// Vitest 4 以降は workspace のファイルと --workspace の指定がなくなったため、ここで一覧を作り、
// ルートの vitest.config.ts の test.projects から読む。
import type { TestProjectConfiguration } from 'vitest/config';

const projects: TestProjectConfiguration[] = [
  {
    test: {
      name: 'backend',
      include: ['backend/**/*.test.ts', 'scripts/**/*.test.ts'],
      environment: 'node',
      // DynamoDB Local の起動を待つ結合の試験のため長めにする
      testTimeout: 30_000,
      hookTimeout: 120_000,
    },
  },
  './frontend/vitest.config.ts',
  {
    test: {
      name: 'infra',
      include: ['infra/test/**/*.test.ts'],
      environment: 'node',
      // CDK の synth は時間がかかる
      testTimeout: 120_000,
    },
  },
];

export default projects;
