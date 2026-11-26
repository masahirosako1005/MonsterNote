// U1 の E2E（AWS なし。API はモックのサーバー）: US1.1・US2.1・US4.1〜US4.3・US5.1、NFR7.1
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const HUNTER = 'http://localhost:5273';
const REQUESTER = 'http://localhost:5274';
const API = 'http://localhost:4610';

// 1x1 の PNG（写真として選ぶ）
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** 実行時の設定 config.json をモックの API に向ける */
async function useMockConfig(page: Page) {
  await page.route('**/config.json', (route) => route.fulfill({ json: { apiBaseUrl: API } }));
}

// 試験ごとにモックのデータを空にし、画面の設定をモックの API に向ける
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

async function reportOne(page: Page) {
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: PNG });
  // U2: アップロードの完了で判別の結果（またはできなかった旨）を見せてから次へ進む（BR6.2〜BR6.4）
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
  // U2: 位置は地図（MapPicker）で指す
  await expect(page.getByTestId('map-tiles')).toBeVisible();
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('report-done')).toContainText('送りました');
}

test('@u1 ハンターが写真 1 枚で報告し、依頼元が承認すると、ハンターの一覧が「承認」になる', async ({
  browser,
  page,
}) => {
  await login(page, HUNTER, 'hunter01');
  await reportOne(page);
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('status-checking')).toBeVisible();

  // 依頼元は別の利用者として別の画面で開く
  const requesterContext = await browser.newContext();
  const requester = await requesterContext.newPage();
  await useMockConfig(requester);
  await login(requester, REQUESTER, 'city01');
  await requester.getByTestId('report-row').first().click();
  await expect(requester.getByTestId('detail-species')).toHaveText('イノシシ');
  await requester.getByTestId('approve-button').click();
  await expect(requester.getByTestId('status-approved')).toBeVisible();
  await expect(requester.getByTestId('approve-button')).toHaveCount(0);
  await requesterContext.close();

  await page.reload();
  await expect(page.getByTestId('status-approved')).toBeVisible();
});

test('@u1 ハンターは依頼元の画面にも一覧の API にも入れない', async ({ page, request }) => {
  await login(page, REQUESTER, 'hunter01');
  // U4: 管理者も依頼元の画面に入れるようになったため文言が変わった（session.ts のロールメッセージ）
  await expect(page.getByRole('alert')).toContainText('依頼元・管理者の方だけ');
  const res = await request.get(`${API}/v1/catalog/reports`, {
    headers: { authorization: 'Bearer token-hunter-a' },
  });
  expect(res.status()).toBe(403);
});

test('@u1 間違ったパスワードでは「ID かパスワードが違います」と表示し、ID は残す', async ({
  page,
}) => {
  await login(page, HUNTER, 'hunter01', 'wrong-pass');
  await expect(page.getByRole('alert')).toContainText('ID かパスワードが違います');
  await expect(page.getByTestId('login-id')).toHaveValue('hunter01');
});

test('@u1 ハンターの画面はボタン 64px 以上・文字 20px', async ({ page }) => {
  await login(page, HUNTER, 'hunter01');
  const button = page.getByTestId('start-report');
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  const fontSize = await button.evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe('20px');
});

test('@u1 ハンターの画面（ログイン・ホーム・写真）に重大なアクセシビリティの違反がない', async ({
  page,
}) => {
  const critical = async () =>
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'critical');
  await page.goto(`${HUNTER}/login`);
  await expect(page.getByTestId('login-id')).toBeVisible();
  expect(await critical()).toEqual([]);
  await login(page, HUNTER, 'hunter01');
  await expect(page.getByTestId('start-report')).toBeVisible();
  expect(await critical()).toEqual([]);
  await page.getByTestId('start-report').click();
  await expect(page.getByTestId('step-count')).toHaveText('1/3');
  expect(await critical()).toEqual([]);
});

test('@u1 依頼元の画面（ログイン・一覧・詳細）に重大なアクセシビリティの違反がない', async ({
  browser,
  page,
}) => {
  // 先にハンターが 1 件送っておく
  const hunterContext = await browser.newContext({
    geolocation: { latitude: 35, longitude: 135 },
    permissions: ['geolocation'],
  });
  const hunter = await hunterContext.newPage();
  await useMockConfig(hunter);
  await login(hunter, HUNTER, 'hunter01');
  await reportOne(hunter);
  await hunterContext.close();

  const critical = async () =>
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'critical');
  await page.goto(`${REQUESTER}/login`);
  await expect(page.getByTestId('login-id')).toBeVisible();
  expect(await critical()).toEqual([]);
  await login(page, REQUESTER, 'city01');
  await expect(page.getByTestId('report-row')).toHaveCount(1);
  expect(await critical()).toEqual([]);
  await page.getByTestId('report-row').click();
  await expect(page.getByTestId('approve-button')).toBeVisible();
  expect(await critical()).toEqual([]);
});
