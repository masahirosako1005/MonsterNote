// U3: 詳細画面の却下・取り消し（UC15・UC16。BR3.8・BR3.9、D-6・NFR7.7）
// undoUntil は絶対時刻のため、現在時刻を固定して試験する（NFR7.5）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, server } from '../../../test/msw-server';
import { listItem, sessionHandlers } from '../../../test/api-fixtures';
import { RequesterApp } from '../App';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-23T04:00:00.000Z'), shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

function newUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function renderApp(path: string) {
  return render(<RequesterApp config={{ apiBaseUrl: API }} initialPath={path} />);
}

async function login(user: ReturnType<typeof newUser>) {
  await user.type(await screen.findByTestId('login-id'), 'city01');
  await user.type(screen.getByTestId('login-password'), 'pass1234');
  await user.click(screen.getByTestId('login-submit'));
}

/** ログイン済みとして詳細を直接開く（出し直し用の値を保存しておく）
 * U4: RequesterAppはrequester・adminの両方を許すようになったため、保存場所のキーも
 * 両方をまとめた形になる（session.tsのallowedRoles）
 */
function asLoggedIn() {
  window.localStorage.setItem('monsternote.admin+requester.refreshToken', 'refresh-1');
}

const report = {
  reportId: 'report-1',
  hunterAccountId: 'hunter-a',
  hunterNumber: '123',
  species: 'boar',
  sex: 'male',
  capturedAt: '2026-11-23T03:00:00.000Z',
  capturedAtSource: 'device',
  location: { lat: 35.1, lng: 135.2 },
  locationSource: 'device',
  submittedAt: '2026-11-23T03:00:00.000Z',
  photos: [
    { photoId: 'photo-1', kind: 'body', url: 'https://s3.test/photo-1?sig', expiresInSeconds: 900 },
  ],
};

function baseHandlers() {
  return [
    ...sessionHandlers('requester', '市の担当'),
    http.get(`${API}/v1/catalog/reports`, () =>
      HttpResponse.json({ items: [listItem(1)], nextCursor: null, totalCount: 1 }),
    ),
    http.get(`${API}/v1/reports/report-1`, () => HttpResponse.json(report)),
  ];
}

describe('DetailPage（U3: 却下・取り消し）', () => {
  it('却下の理由を選んで確定すると、却下した状態になり、10 秒の取り消すボタンが出る（UC15）', async () => {
    const user = newUser();
    let state: { status: string; reason?: string; reasonText?: string; undoUntil?: string } = {
      status: 'checking',
    };
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/reviews/report-1`, () =>
        HttpResponse.json({ reportId: 'report-1', ...state }),
      ),
      http.put(`${API}/v1/reviews/report-1/decision`, async ({ request }) => {
        const body = (await request.json()) as {
          decision: string;
          reason?: string;
          reasonText?: string;
        };
        state = {
          status: 'rejected',
          reason: body.reason,
          reasonText: body.reasonText,
          undoUntil: '2026-11-23T04:00:10.000Z',
        };
        return HttpResponse.json({
          reportId: 'report-1',
          decidedByName: '市の担当',
          decidedAt: '2026-11-23T04:00:00.000Z',
          ...state,
        });
      }),
    );
    renderApp('/reports');
    await login(user);
    await user.click(await screen.findByTestId('report-row'));
    await user.click(await screen.findByTestId('reject-button'));
    await user.click(await screen.findByTestId('reject-reason-duplicate'));
    await user.click(screen.getByTestId('reject-confirm'));

    expect(await screen.findByTestId('status-rejected')).toBeInTheDocument();
    expect(screen.getByTestId('detail-reject-reason')).toHaveTextContent('重複の疑い');
    expect(await screen.findByTestId('undo-button')).toHaveTextContent('残り 10 秒');
  });

  it('「その他」は文の入力が必須で、空のままでは確定できない（BR3.8）', async () => {
    const user = newUser();
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/reviews/report-1`, () =>
        HttpResponse.json({ reportId: 'report-1', status: 'checking' }),
      ),
    );
    renderApp('/reports');
    await login(user);
    await user.click(await screen.findByTestId('report-row'));
    await user.click(await screen.findByTestId('reject-button'));
    await user.click(await screen.findByTestId('reject-reason-other'));
    expect(screen.getByTestId('reject-confirm')).toBeDisabled();
    await user.type(screen.getByTestId('reject-reason-text'), '写真が不鮮明');
    expect(screen.getByTestId('reject-confirm')).toBeEnabled();
  });

  it('取り消すと確認中に戻る（UC16）', async () => {
    const user = newUser();
    let state: { status: string; undoUntil?: string } = {
      status: 'approved',
      undoUntil: '2026-11-23T04:00:10.000Z',
    };
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/reviews/report-1`, () =>
        HttpResponse.json({
          reportId: 'report-1',
          status: state.status,
          ...(state.status === 'approved'
            ? {
                decidedByName: '市の担当',
                decidedAt: '2026-11-23T04:00:00.000Z',
                undoUntil: state.undoUntil,
              }
            : {}),
        }),
      ),
      http.post(`${API}/v1/reviews/report-1/decision/undo`, () => {
        state = { status: 'checking' };
        return HttpResponse.json({ reportId: 'report-1', status: 'checking' });
      }),
    );
    asLoggedIn();
    renderApp('/reports/report-1');
    expect(await screen.findByTestId('undo-button')).toBeInTheDocument();
    await user.click(screen.getByTestId('undo-button'));
    await waitFor(() => expect(screen.getByTestId('status-checking')).toBeInTheDocument());
    expect(screen.queryByTestId('undo-button')).toBeNull();
  });

  it('取り消しの二重送信で ALREADY_UNDONE が返っても、エラーを出さず状態を出し直す（D-6・NFR7.7）', async () => {
    const user = newUser();
    // 1 回目の取り消しはすでに成功していて、2 回目（この画面の操作）は ALREADY_UNDONE になる想定
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/reviews/report-1`, () =>
        HttpResponse.json({
          reportId: 'report-1',
          status: 'approved',
          decidedByName: '市の担当',
          decidedAt: '2026-11-23T04:00:00.000Z',
          undoUntil: '2026-11-23T04:00:10.000Z',
        }),
      ),
      http.post(`${API}/v1/reviews/report-1/decision/undo`, () =>
        HttpResponse.json(
          { code: 'ALREADY_UNDONE', message: 'すでに確認中に戻っています' },
          { status: 409 },
        ),
      ),
    );
    asLoggedIn();
    renderApp('/reports/report-1');
    await user.click(await screen.findByTestId('undo-button'));
    // エラー表示にせず、GET で読み直した「承認」の状態をそのまま出す（NFR7.7）
    await waitFor(() => expect(screen.getByTestId('status-approved')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
