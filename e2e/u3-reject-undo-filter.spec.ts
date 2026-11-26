// U3 の E2E（AWS なし。API はモックのサーバー）: 却下（BR3.8）、取り消し（BR3.9・BR3.15）、
// 一覧の状態・印による絞り込み（BR4.5）
import { test, expect, type Page } from '@playwright/test';

const HUNTER = 'http://localhost:5273';
const REQUESTER = 'http://localhost:5274';
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

async function submitOneReport(
  page: Page,
  hunter: string,
  photoName = 'body.png',
  species: 'boar' | 'deer' = 'boar',
) {
  await login(page, HUNTER, hunter);
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: photoName, mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('detection-result')).toBeVisible();
  await page.getByTestId('photo-next').click();
  // U2（新規。Build and Testで発見）: 尻尾の写真（必須）
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'tail.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('photo-tail-next').click();
  await page.getByTestId(`species-${species}`).click();
  await page.getByTestId('sex-male').click();
  await page.getByTestId('age-class-adult').click();
  await page.getByTestId('capture-method-trap').click();
  await page.getByTestId('choice-next').click();
  await expect(page.getByTestId('map-tiles')).toBeVisible();
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('report-done')).toContainText('送りました');
  await page.getByTestId('go-home').click();
}

test('@u3 却下すると理由が記録され、ハンターの一覧・詳細にも却下と理由が出る（BR3.8・BR3.14）', async ({
  browser,
  page,
}) => {
  await submitOneReport(page, 'hunter01');

  const requesterContext = await browser.newContext();
  const requester = await requesterContext.newPage();
  await useMockConfig(requester);
  await login(requester, REQUESTER, 'city01');
  await requester.getByTestId('report-row').first().click();
  await requester.getByTestId('reject-button').click();
  await requester.getByTestId('reject-reason-insufficient-photo').click();
  await requester.getByTestId('reject-confirm').click();
  await expect(requester.getByTestId('status-rejected')).toBeVisible();
  await requesterContext.close();

  await page.goto(`${HUNTER}/`);
  await expect(page.getByTestId('status-rejected')).toBeVisible();
});

test('@u3 却下の理由で「その他」を選ぶと、文を空白のままでは確定できない', async ({
  browser,
  page,
}) => {
  await submitOneReport(page, 'hunter01');

  const requesterContext = await browser.newContext();
  const requester = await requesterContext.newPage();
  await useMockConfig(requester);
  await login(requester, REQUESTER, 'city01');
  await requester.getByTestId('report-row').first().click();
  await requester.getByTestId('reject-button').click();
  await requester.getByTestId('reject-reason-other').click();
  await expect(requester.getByTestId('reject-confirm')).toBeDisabled();
  await requester.getByTestId('reject-reason-text').fill('   ');
  await expect(requester.getByTestId('reject-confirm')).toBeDisabled();
  await requester.getByTestId('reject-reason-text').fill('写真が不鮮明なため');
  await expect(requester.getByTestId('reject-confirm')).toBeEnabled();
  await requester.getByTestId('reject-confirm').click();
  await expect(requester.getByTestId('status-rejected')).toBeVisible();
  await requesterContext.close();
});

test('@u3 却下した直後は取り消しができ、取り消すと確認中に戻る（BR3.9・BR3.15）', async ({
  page,
}) => {
  await submitOneReport(page, 'hunter01');
  await login(page, REQUESTER, 'city01');
  await page.getByTestId('report-row').first().click();
  await page.getByTestId('reject-button').click();
  await page.getByTestId('reject-reason-out-of-scope').click();
  await page.getByTestId('reject-confirm').click();
  await expect(page.getByTestId('status-rejected')).toBeVisible();

  await expect(page.getByTestId('undo-button')).toBeVisible();
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('status-checking')).toBeVisible();
  // 確認中に戻ったので、もう一度、承認・却下ができる
  await expect(page.getByTestId('approve-button')).toBeVisible();
});

test('@u3 一覧を状態で絞り込める: 却下だけに絞ると、承認済みは出ない（BR4.5）', async ({
  browser,
  page,
}) => {
  await submitOneReport(page, 'hunter01', 'rejected-one.png');

  const requesterContext = await browser.newContext();
  const requester = await requesterContext.newPage();
  await useMockConfig(requester);
  await login(requester, REQUESTER, 'city01');
  await requester.getByTestId('report-row').first().click();
  await requester.getByTestId('reject-button').click();
  await requester.getByTestId('reject-reason-out-of-scope').click();
  await requester.getByTestId('reject-confirm').click();
  await requester.getByTestId('back-to-list').click();
  await requesterContext.close();

  // 2 件目は承認する
  const hunterContext = await browser.newContext({
    geolocation: { latitude: 35.1, longitude: 135.8 },
    permissions: ['geolocation'],
  });
  const hunter2 = await hunterContext.newPage();
  await useMockConfig(hunter2);
  // 種類を変える（イノシシのまま出すと U2 の重複確認ダイアログが割り込むため）
  await submitOneReport(hunter2, 'hunter02', 'approved-one.png', 'deer');
  await hunterContext.close();

  await login(page, REQUESTER, 'city01');
  await expect(page.getByTestId('report-row')).toHaveCount(2);
  await page.getByTestId('report-row').first().click();
  await page.getByTestId('approve-button').click();
  await page.getByTestId('back-to-list').click();

  await page.getByTestId('filter-status-rejected').click();
  await expect(page.getByTestId('report-row')).toHaveCount(1);
  await expect(page.getByTestId('status-rejected')).toBeVisible();
  await expect(page.getByTestId('status-approved')).toHaveCount(0);

  await page.getByTestId('filter-clear').click();
  await expect(page.getByTestId('report-row')).toHaveCount(2);
});

test('@u3 一覧を重複の疑いの印で絞り込める（BR4.5・BR7.1）', async ({ page }) => {
  // 1 件目（イノシシ）
  await submitOneReport(page, 'hunter01', 'first.png');

  // 2 件目（同じ種類。重複の確認ダイアログで「別の個体なので送る」を選ぶ）
  await page.getByTestId('start-report').click();
  await page
    .getByTestId('photo-input')
    .setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: PNG });
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

  await login(page, REQUESTER, 'city01');
  await expect(page.getByTestId('report-row')).toHaveCount(2);

  await page.getByTestId('filter-flag-duplicate').click();
  await expect(page.getByTestId('report-row')).toHaveCount(1);
  await expect(page.getByTestId('duplicate-flag')).toBeVisible();

  await page.getByTestId('filter-clear').click();
  await expect(page.getByTestId('report-row')).toHaveCount(2);
});
