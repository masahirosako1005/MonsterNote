// Playwright の設定（AWS を使わない E2E。team.md の E2E、cicd-pipeline 段階 1・2）。
// 2 つの画面（Vite）と API のモックのサーバーを起動する。U1 の試験はタイトルに @u1 を付ける。
import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // モックのサーバーのデータを共有するため、1 つずつ順に動かす
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // ハンターはスマホで使う（iPhone の Safari に近い WebKit）
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  // すでに動いている別のサーバーを使い回さない（同じ番号のほかのプロジェクトの画面を試験しないため）
  webServer: [
    {
      command: 'npx tsx e2e/mock-api.ts',
      url: 'http://localhost:4610/__photo/check',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    // 画面はビルドしたもの（vite preview）で試す。デプロイするものと同じで、開発サーバーの途中の読み直しもない
    {
      command: 'npm run e2e:hunter --workspace frontend',
      url: 'http://localhost:5273',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm run e2e:requester --workspace frontend',
      url: 'http://localhost:5274',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
