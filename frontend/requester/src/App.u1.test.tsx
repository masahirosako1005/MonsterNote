// 依頼元の画面の流れの試験（UC1・UC3・UC4、AC1.1.2・AC1.1.4・AC4.1.3・AC4.1.4・AC4.2.1・AC4.3.1・AC4.3.3）
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, server } from '../../test/msw-server';
import { listItem, sessionHandlers } from '../../test/api-fixtures';
import { RequesterApp } from './App';

function renderApp(path = '/login') {
  return render(<RequesterApp config={{ apiBaseUrl: API }} initialPath={path} />);
}

async function login() {
  await userEvent.type(await screen.findByTestId('login-id'), 'city01');
  await userEvent.type(screen.getByTestId('login-password'), 'pass1234');
  await userEvent.click(screen.getByTestId('login-submit'));
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

describe('RequesterApp', () => {
  it('ログイン → 一覧 → 詳細 → 承認すると状態が「承認」になり、ボタンが消える', async () => {
    let status = 'checking';
    server.use(
      ...sessionHandlers('requester', '市の担当'),
      http.get(`${API}/v1/catalog/reports`, () =>
        HttpResponse.json({ items: [listItem(1)], nextCursor: null, totalCount: 1 }),
      ),
      http.get(`${API}/v1/reports/report-1`, () => HttpResponse.json(report)),
      http.get(`${API}/v1/reviews/report-1`, () =>
        HttpResponse.json(
          status === 'checking'
            ? { reportId: 'report-1', status }
            : {
                reportId: 'report-1',
                status,
                decidedByName: '市の担当',
                decidedAt: '2026-11-23T04:00:00.000Z',
              },
        ),
      ),
      http.get(`${API}/v1/duplicates/report-1`, () =>
        HttpResponse.json({ reportId: 'report-1', matches: [] }),
      ),
      http.put(`${API}/v1/reviews/report-1/decision`, () => {
        status = 'approved';
        return HttpResponse.json({ reportId: 'report-1', status: 'approved' });
      }),
    );
    renderApp();
    await login();
    await userEvent.click(await screen.findByTestId('report-row'));
    expect(await screen.findByTestId('report-photo')).toHaveAttribute(
      'src',
      'https://s3.test/photo-1?sig',
    );
    expect(screen.getByTestId('detail-species')).toHaveTextContent('イノシシ');
    expect(screen.getByTestId('detail-sex')).toHaveTextContent('オス');
    await userEvent.click(await screen.findByTestId('approve-button'));
    expect(await screen.findByTestId('status-approved')).toBeInTheDocument();
    expect(screen.queryByTestId('approve-button')).toBeNull();
    expect(screen.getByTestId('detail-decided-by')).toHaveTextContent('市の担当');
  });

  it('0 件なら「報告はまだありません」', async () => {
    server.use(
      ...sessionHandlers('requester'),
      http.get(`${API}/v1/catalog/reports`, () =>
        HttpResponse.json({ items: [], nextCursor: null, totalCount: 0 }),
      ),
    );
    renderApp();
    await login();
    expect(await screen.findByTestId('report-list-empty')).toHaveTextContent(
      '報告はまだありません',
    );
  });

  it('51 件なら 1 ページ目に 50 件、「次の 50 件」で 2 ページ目に 1 件', async () => {
    server.use(
      ...sessionHandlers('requester'),
      http.get(`${API}/v1/catalog/reports`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return cursor === 'c1'
          ? HttpResponse.json({ items: [listItem(51)], nextCursor: null, totalCount: 51 })
          : HttpResponse.json({
              items: Array.from({ length: 50 }, (_, i) => listItem(i + 1)),
              nextCursor: 'c1',
              totalCount: 51,
            });
      }),
    );
    renderApp();
    await login();
    expect(await screen.findAllByTestId('report-row')).toHaveLength(50);
    await userEvent.click(screen.getByTestId('report-list-next'));
    expect(await screen.findByText('2 ページ目')).toBeInTheDocument();
    expect(screen.getAllByTestId('report-row')).toHaveLength(1);
  });

  it('確認の記録がまだない報告は「確認中」として出し、承認で 404 なら案内を出す', async () => {
    server.use(
      ...sessionHandlers('requester'),
      http.get(`${API}/v1/reports/report-1`, () => HttpResponse.json(report)),
      http.get(`${API}/v1/reviews/report-1`, () =>
        HttpResponse.json({ code: 'REVIEW_NOT_READY', message: 'まだ' }, { status: 404 }),
      ),
      http.get(`${API}/v1/duplicates/report-1`, () =>
        HttpResponse.json({ reportId: 'report-1', matches: [] }),
      ),
      http.put(`${API}/v1/reviews/report-1/decision`, () =>
        HttpResponse.json(
          {
            code: 'REVIEW_NOT_READY',
            message: 'まだ確認の準備ができていません。少し待ってからもう一度押してください',
          },
          { status: 404 },
        ),
      ),
    );
    // 保存した出し直し用の値でログインを続け、詳細を直接開く
    // U4: RequesterAppはrequester・adminの両方を許すため、保存場所のキーも両方をまとめた形になる
    window.localStorage.setItem('monsternote.admin+requester.refreshToken', 'refresh-1');
    renderApp('/reports/report-1');
    expect(await screen.findByTestId('status-checking')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('approve-button'));
    expect(await screen.findByText(/まだ確認の準備ができていません/)).toBeInTheDocument();
  });

  it('ハンターのアカウントでは依頼元の画面に入れない', async () => {
    server.use(...sessionHandlers('hunter'));
    renderApp();
    await login();
    // U4: RequesterAppはrequester・adminの両方を許すため、両方を挙げたメッセージになる
    expect(await screen.findByRole('alert')).toHaveTextContent('依頼元・管理者の方だけ');
  });
});
