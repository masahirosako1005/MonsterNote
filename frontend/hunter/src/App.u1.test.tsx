// ハンターの画面の流れの試験（UC1・UC2・UC5、AC1.1.1・AC1.1.5・AC2.1.1・AC2.1.2・AC2.1.3・AC5.1.4）
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, server } from '../../test/msw-server';
import { listItem, sessionHandlers } from '../../test/api-fixtures';
import { HunterApp } from './App';

const deps = {
  resize: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
  getPosition: vi.fn(async () => ({ lat: 35.1, lng: 135.2 })),
  sleep: async () => undefined,
};

function renderApp(path = '/') {
  return render(<HunterApp config={{ apiBaseUrl: API }} initialPath={path} deps={deps} />);
}

async function login() {
  await userEvent.type(await screen.findByTestId('login-id'), 'hunter01');
  await userEvent.type(screen.getByTestId('login-password'), 'pass1234');
  await userEvent.click(screen.getByTestId('login-submit'));
}

/** 写真の受け付け → S3 への POST → complete の応答 */
function photoHandlers() {
  return [
    http.post(`${API}/v1/photos`, () =>
      HttpResponse.json(
        {
          photoId: 'photo-1',
          uploadUrl: 'http://s3.test/bucket',
          uploadFields: { key: 'photos/h/photo-1' },
          expiresInSeconds: 300,
        },
        { status: 201 },
      ),
    ),
    http.post('http://s3.test/bucket', () => new HttpResponse(null, { status: 204 })),
    http.post(`${API}/v1/photos/photo-1/complete`, () =>
      HttpResponse.json({ photoId: 'photo-1', uploadStatus: 'uploaded' }),
    ),
  ];
}

async function goToSubmit() {
  await userEvent.click(await screen.findByTestId('start-report'));
  const file = new File(['x'], 'body.jpg', { type: 'image/jpeg' });
  await userEvent.upload(await screen.findByTestId('photo-input'), file);
  // 種類と雌雄（選ぶまで次へは押せない）
  const next = await screen.findByTestId('choice-next');
  expect(next).toBeDisabled();
  await userEvent.click(screen.getByTestId('species-boar'));
  expect(next).toBeDisabled();
  await userEvent.click(screen.getByTestId('sex-male'));
  expect(next).toBeEnabled();
  await userEvent.click(next);
  await screen.findByTestId('location-ok');
}

describe('HunterApp', () => {
  it('ログインするとホーム（自分の一覧）を表示する。0 件なら案内の文', async () => {
    server.use(
      ...sessionHandlers('hunter', 'ハンター A'),
      http.get(`${API}/v1/catalog/my-reports`, () =>
        HttpResponse.json({ items: [], nextCursor: null, totalCount: 0 }),
      ),
    );
    renderApp('/login');
    await login();
    expect(await screen.findByTestId('report-list-empty')).toHaveTextContent(
      'まだ報告はありません。上の『報告する』から始めます',
    );
    expect(window.localStorage.getItem('monsternote.hunter.refreshToken')).toBe('refresh-1');
  });

  it('写真 → 種類と雌雄 → 送信 → 完了 → ホームの一覧に「確認中」で出る', async () => {
    const sent: unknown[] = [];
    server.use(
      ...sessionHandlers('hunter'),
      ...photoHandlers(),
      http.get(`${API}/v1/catalog/my-reports`, () =>
        HttpResponse.json({ items: [], nextCursor: null, totalCount: 0 }),
      ),
      http.post(`${API}/v1/reports`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ reportId: 'report-new' }, { status: 201 });
      }),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    await userEvent.click(screen.getByTestId('submit-report'));
    expect(await screen.findByTestId('report-done')).toHaveTextContent('送りました');
    expect(sent[0]).toMatchObject({
      photos: { body: 'photo-1' },
      species: 'boar',
      sex: 'male',
      location: { lat: 35.1, lng: 135.2 },
    });
    expect(typeof (sent[0] as { submissionKey: string }).submissionKey).toBe('string');
    await userEvent.click(screen.getByTestId('go-home'));
    // 一覧に知らせが届くまでの間は、送った報告を仮に先頭に出す
    expect(await screen.findByTestId('status-checking')).toHaveTextContent('確認中');
  });

  it('送信に失敗したら選んだ内容を残し、「もう一度」は同じ送信のキーで送る', async () => {
    const keys: string[] = [];
    let fail = true;
    server.use(
      ...sessionHandlers('hunter'),
      ...photoHandlers(),
      http.get(`${API}/v1/catalog/my-reports`, () =>
        HttpResponse.json({ items: [], nextCursor: null, totalCount: 0 }),
      ),
      http.post(`${API}/v1/reports`, async ({ request }) => {
        keys.push(((await request.json()) as { submissionKey: string }).submissionKey);
        if (fail) return HttpResponse.error();
        return HttpResponse.json({ reportId: 'report-new' }, { status: 201 });
      }),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    await userEvent.click(screen.getByTestId('submit-report'));
    expect(await screen.findByRole('alert')).toHaveTextContent('送れませんでした');
    expect(screen.getByTestId('summary-species')).toHaveTextContent('イノシシ');
    fail = false;
    await userEvent.click(screen.getByTestId('submit-report'));
    await screen.findByTestId('report-done');
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('処理中（409 SUBMISSION_IN_PROGRESS）なら 2 秒待って同じキーで送り直す', async () => {
    let calls = 0;
    server.use(
      ...sessionHandlers('hunter'),
      ...photoHandlers(),
      http.get(`${API}/v1/catalog/my-reports`, () =>
        HttpResponse.json({ items: [], nextCursor: null, totalCount: 0 }),
      ),
      http.post(`${API}/v1/reports`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { code: 'SUBMISSION_IN_PROGRESS', message: 'x', conflict: { retryAfterSeconds: 2 } },
              { status: 409 },
            )
          : HttpResponse.json({ reportId: 'report-new' }, { status: 200 });
      }),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    await userEvent.click(screen.getByTestId('submit-report'));
    await screen.findByTestId('report-done');
    expect(calls).toBe(2);
  });

  it('依頼元のアカウントではハンターの画面に入れない', async () => {
    server.use(...sessionHandlers('requester'));
    renderApp('/login');
    await login();
    expect(await screen.findByRole('alert')).toHaveTextContent('ハンターの方だけ');
    expect(window.localStorage.getItem('monsternote.hunter.refreshToken')).toBeNull();
  });

  it('保存した出し直し用の値でログインを続け、ログアウトでログイン画面に戻る（戻っても開けない）', async () => {
    let deleted = false;
    window.localStorage.setItem('monsternote.hunter.refreshToken', 'refresh-1');
    // msw は先に並べたハンドラーを使うため、ログアウトの記録を先に置く
    server.use(
      http.delete(`${API}/v1/session`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      ...sessionHandlers('hunter'),
      http.get(`${API}/v1/catalog/my-reports`, () =>
        HttpResponse.json({ items: [listItem(1, 'approved')], nextCursor: null, totalCount: 1 }),
      ),
    );
    renderApp('/');
    expect(await screen.findByTestId('status-approved')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('logout'));
    expect(await screen.findByTestId('login-id')).toBeInTheDocument();
    await waitFor(() => expect(deleted).toBe(true));
    expect(window.localStorage.getItem('monsternote.hunter.refreshToken')).toBeNull();
  });

  it('ログインしていなければログイン画面に移る', async () => {
    renderApp('/report/photo');
    expect(await screen.findByTestId('login-id')).toBeInTheDocument();
  });
});
