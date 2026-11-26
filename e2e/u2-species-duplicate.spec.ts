// U2 の E2E（AWS なし。API はモックのサーバー）: 種類の自動判別の表示（BR6.2〜BR6.4）、
// 重複の確認ダイアログ（BR7.1・BR7.2）、対象地域の読み出し（ADR-010）
import { test, expect, type Page } from '@playwright/test';

const HUNTER = 'http://localhost:5273';
const API = 'http://localhost:4610';

// 1x1 の PNG（写真として選ぶ）
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function useMockConfig(page: Page) {
  await page.route('**/config.json', (route) => route.fulfill({ json: { apiBaseUrl: API } }));
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await useMockConfig(page);
});

test.use({
  geolocation: { latitude: 35.0116, longitude: 135.7681 },
  permissions: ['geolocation'],
});

async function login(page: Page, base: string, loginId: string, password = 'pass1234') {
  await page.goto(`${base}/login`);
  await page.getByTestId('login-id').fill(loginId);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

test('@u2 全身の写真の判別ができると、その種類を選んだ状態で次に進める。選び直せる（BR6.4）', async ({
  page,
}) => {
  await login(page, HUNTER, 'hunter01');
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('detection-result')).toContainText('イノシシ（92%）');
  await page.getByTestId('photo-next').click();
  // U2（新規。Build and Testで発見）: 尻尾の写真（必須）
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'tail.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-tail-next').click();
  await expect(page.getByTestId('species-boar')).toHaveAttribute('aria-checked', 'true');
  // 選び直せる
  await page.getByTestId('species-deer').click();
  await expect(page.getByTestId('species-deer')).toHaveAttribute('aria-checked', 'true');
});

test('@u2 判別できなかったときは「手で選んでください」とし、何も選ばれていない（BR6.3）', async ({
  page,
  request,
}) => {
  // モックの API に「次は判別できない」と伝える
  await request.post(`${API}/__set-detection`, { data: { outcome: 'undetected' } });
  await login(page, HUNTER, 'hunter01');
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('detection-result')).toContainText(
    '判別できませんでした。手で選んでください',
  );
  await page.getByTestId('photo-next').click();
  // U2（新規。Build and Testで発見）: 尻尾の写真（必須）
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'tail.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-tail-next').click();
  await expect(page.getByTestId('species-boar')).toHaveAttribute('aria-checked', 'false');
});

async function submitOneBoar(page: Page, hunter: string) {
  await login(page, HUNTER, hunter);
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('detection-result')).toBeVisible();
  await page.getByTestId('photo-next').click();
  // U2（新規。Build and Testで発見）: 尻尾の写真（必須）
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'tail.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-tail-next').click();
  await page.getByTestId('species-boar').click();
  await page.getByTestId('sex-male').click();
  await page.getByTestId('age-class-adult').click();
  await page.getByTestId('capture-method-trap').click();
  await page.getByTestId('choice-next').click();
  await expect(page.getByTestId('map-tiles')).toBeVisible();
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('report-done')).toContainText('送りました');
  await page.getByTestId('go-home').click();
}

test('@u2 近くで同じ種類の報告があると確認ダイアログが出る。「別の個体なので送る」で送れる（BR7.1・BR7.2）', async ({
  page,
}) => {
  // 1 件目（イノシシ）を先に送っておく
  await submitOneBoar(page, 'hunter01');

  // 2 件目（同じ種類）は重複の確認ダイアログが出る
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'body2.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('detection-result')).toBeVisible();
  await page.getByTestId('photo-next').click();
  // U2（新規。Build and Testで発見）: 尻尾の写真（必須）
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'tail.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-tail-next').click();
  await page.getByTestId('species-boar').click();
  await page.getByTestId('sex-male').click();
  await page.getByTestId('age-class-adult').click();
  await page.getByTestId('capture-method-trap').click();
  await page.getByTestId('choice-next').click();
  await page.getByTestId('submit-report').click();
  await expect(page.getByRole('dialog')).toContainText('イノシシ');
  await page.getByTestId('duplicate-confirm').click();
  await expect(page.getByTestId('report-done')).toContainText('送りました');
});

test('@u2 対象地域の設定を読んで、地図の警告なしで報告できる（ADR-010）', async ({ page }) => {
  await login(page, HUNTER, 'hunter01');
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-next').click();
  // U2（新規。Build and Testで発見）: 尻尾の写真（必須）
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'tail.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-tail-next').click();
  await page.getByTestId('species-boar').click();
  await page.getByTestId('sex-male').click();
  await page.getByTestId('age-class-adult').click();
  await page.getByTestId('capture-method-trap').click();
  await page.getByTestId('choice-next').click();
  await expect(page.getByTestId('map-tiles')).toBeVisible();
  // 既定の地図の中心（日本のおおよその中心）は対象地域の中なので、警告は出ない
  await expect(page.getByTestId('map-outside-area')).toHaveCount(0);
});
