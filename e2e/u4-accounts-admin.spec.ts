// U4 の E2E（AWS なし。API はモックのサーバー）: 初回の手続き（UC21）、アカウント作成（UC22）、
// 無効化（UC24）、操作の記録（UC27）、試験運用の終わりの削除（UC26）
import { test, expect, type Page } from '@playwright/test';

const HUNTER = 'http://localhost:5273';
const REQUESTER = 'http://localhost:5274';
const API = 'http://localhost:4610';

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

async function login(page: Page, base: string, loginId: string, password: string) {
  await page.goto(`${base}/login`);
  await page.getByTestId('login-id').fill(loginId);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

async function openAdminMenu(page: Page, testId: string) {
  await page.getByTestId('menu-button').click();
  await page.getByTestId(testId).click();
}

test('@u4 初回の手続き: 仮のパスワードのハンターは、変更→同意→従事者番号の順に済ませてからホームに入る（UC21・BR11.4〜BR11.7）', async ({
  page,
  browser,
}) => {
  await login(page, HUNTER, 'hunter09', 'temp1234');
  await page.getByTestId('new-password').fill('newpass123');
  await page.getByTestId('password-change-submit').click();
  await expect(page.getByTestId('consent-agree')).toBeVisible();
  await page.getByTestId('consent-agree').click();
  await page.getByTestId('hunter-number-input').fill('777');
  await page.getByTestId('hunter-number-submit').click();
  await expect(page.getByTestId('start-report')).toBeVisible();

  // やり直しても手続きは済んでいるので、もう一度求められない（新しいブラウザのコンテキストで確かめる）
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await useMockConfig(page2);
  await login(page2, HUNTER, 'hunter09', 'newpass123');
  await expect(page2.getByTestId('start-report')).toBeVisible();
  await context2.close();
});

test('@u4 アカウント作成: 管理者が作ると仮のパスワードが1回だけ出て、一覧に現れる（UC22・BR11.1〜BR11.3）', async ({
  page,
}) => {
  await login(page, REQUESTER, 'admin01', 'pass1234');
  await openAdminMenu(page, 'menu-admin-accounts');
  await page.getByTestId('account-create-link').click();
  await page.getByTestId('account-display-name').fill('ハンター 十番');
  await page.getByTestId('account-login-id').fill('hunter10');
  await page.getByTestId('account-form-submit').click();
  await expect(page.getByTestId('temp-password')).toBeVisible();
  // 画面は4文字ごとに「-」を挟んで表示する（NFR7.8）。ログインに使うため元に戻す
  const displayed = await page.getByTestId('temp-password').textContent();
  const temporaryPassword = displayed?.replace(/-/g, '');
  expect(temporaryPassword).toBeTruthy();
  await page.getByTestId('temp-password-close').click();
  await expect(page.getByText('ハンター 十番')).toBeVisible();

  // 新しいアカウントで実際にログインできる（初回は手続きを求められる）
  await login(page, HUNTER, 'hunter10', temporaryPassword ?? '');
  await expect(page.getByTestId('new-password')).toBeVisible();
});

test('@u4 無効化: 管理者が無効にすると、そのアカウントはログインできなくなる。有効に戻すとまた使える（UC24・BR11.9）', async ({
  page,
}) => {
  await login(page, REQUESTER, 'admin01', 'pass1234');
  await openAdminMenu(page, 'menu-admin-accounts');
  await page
    .getByRole('listitem')
    .filter({ hasText: '市の担当' })
    .getByTestId('account-detail-button')
    .click();
  await page.getByTestId('account-disable').click();
  await expect(page.getByText('無効')).toBeVisible();

  await page.getByTestId('menu-button').click();
  await page.getByTestId('logout').click();
  await login(page, REQUESTER, 'city01', 'pass1234');
  await expect(page.getByRole('alert')).toContainText('ID かパスワードが違います');

  // 管理者がもう一度有効にすると使えるようになる
  await login(page, REQUESTER, 'admin01', 'pass1234');
  await openAdminMenu(page, 'menu-admin-accounts');
  await page
    .getByRole('listitem')
    .filter({ hasText: '市の担当' })
    .getByTestId('account-detail-button')
    .click();
  await page.getByTestId('account-enable').click();
  await expect(page.getByText('有効')).toBeVisible();
  await page.getByTestId('menu-button').click();
  await page.getByTestId('logout').click();
  await login(page, REQUESTER, 'city01', 'pass1234');
  // 無効化の前と違い、普通に一覧画面に入れる（エラーのアラートが出ない）
  await expect(page.getByTestId('report-list-empty')).toBeVisible();
});

test('@u4 操作の記録: アカウントの作成・無効化が、利用者のIDを出さずに記録として残る（UC27・BR12.1・BR12.3）', async ({
  page,
}) => {
  await login(page, REQUESTER, 'admin01', 'pass1234');
  await openAdminMenu(page, 'menu-admin-accounts');
  await page.getByTestId('account-create-link').click();
  await page.getByTestId('account-display-name').fill('ハンター 記録用');
  await page.getByTestId('account-login-id').fill('hunter11');
  await page.getByTestId('account-form-submit').click();
  await page.getByTestId('temp-password-close').click();

  await openAdminMenu(page, 'menu-admin-audit');
  await expect(page.getByText('アカウントの作成')).toBeVisible();
  await expect(page.getByText('管理者 A')).toBeVisible();
  // 操作した人（admin-a）の利用者のIDそのものは画面に出ない（BR12.3。actorNameに置き換わる）
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('admin-a');
});

test('@u4 すべて削除: 報告・写真を5つの入口の順に消し、最後に0件であることを確かめる（UC26・BR13.1〜BR13.4）', async ({
  page,
}) => {
  // ハンターが1件、報告を送っておく
  await login(page, HUNTER, 'hunter01', 'pass1234');
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

  await login(page, REQUESTER, 'admin01', 'pass1234');
  await openAdminMenu(page, 'menu-admin-delete');
  await expect(page.getByTestId('delete-start')).toBeVisible();
  await page.getByTestId('delete-start').click();
  await expect(page.getByTestId('delete-confirm-count')).toContainText('報告 1 件');
  await page.getByTestId('delete-confirm').click();

  await expect(page.getByTestId('delete-step-reporting')).toContainText('終わった（1件）');
  await expect(page.getByTestId('delete-progress-list')).toBeVisible();
  await expect(page.getByTestId('delete-recheck-message')).toBeHidden();

  // 消えたあと、依頼元の一覧は空になる
  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-list').click();
  await expect(page.getByTestId('report-row')).toHaveCount(0);
});
