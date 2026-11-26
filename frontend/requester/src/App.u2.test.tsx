// 依頼元の画面の U2 の振る舞い: 重複の疑いの相手の一覧（C5 GET /v1/duplicates/{reportId}。BR8.8・BR8.9）
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
  ageClass: 'adult',
  captureMethod: 'trap',
  capturedAt: '2026-11-23T03:00:00.000Z',
  capturedAtSource: 'exif',
  location: { lat: 35.1, lng: 135.2 },
  locationSource: 'exif',
  submittedAt: '2026-11-23T03:00:00.000Z',
  photos: [
    { photoId: 'photo-1', kind: 'body', url: 'https://s3.test/photo-1?sig', expiresInSeconds: 900 },
    { photoId: 'photo-2', kind: 'tail', url: 'https://s3.test/photo-2?sig', expiresInSeconds: 900 },
  ],
};

function baseHandlers() {
  return [
    ...sessionHandlers('requester'),
    http.get(`${API}/v1/catalog/reports`, () =>
      HttpResponse.json({ items: [listItem(1)], nextCursor: null, totalCount: 1 }),
    ),
    http.get(`${API}/v1/reports/report-1`, () => HttpResponse.json(report)),
    http.get(`${API}/v1/reviews/report-1`, () =>
      HttpResponse.json({ reportId: 'report-1', status: 'checking' }),
    ),
  ];
}

describe('重複の疑いの相手の一覧（BR8.8・BR8.9）', () => {
  it('疑いがあれば、相手の状態（却下を含む）と距離を一覧で出す。氏名・写真は出さない', async () => {
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/duplicates/report-1`, () =>
        HttpResponse.json({
          reportId: 'report-1',
          matches: [
            {
              matchedReportId: 'report-2',
              kind: 'place-time',
              distanceMeters: 300,
              matchedStatus: 'rejected',
            },
          ],
        }),
      ),
    );
    renderApp();
    await login();
    await userEvent.click(await screen.findByTestId('report-row'));
    const list = await screen.findByTestId('duplicate-list');
    expect(list).toHaveTextContent('却下');
    expect(list).toHaveTextContent('300');
    expect(list.textContent).not.toMatch(/report-2|hunter-/);
  });

  it('疑いがなければ一覧を出さない', async () => {
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/duplicates/report-1`, () =>
        HttpResponse.json({ reportId: 'report-1', matches: [] }),
      ),
    );
    renderApp();
    await login();
    await userEvent.click(await screen.findByTestId('report-row'));
    await screen.findByTestId('detail-species');
    expect(screen.queryByTestId('duplicate-list')).not.toBeInTheDocument();
  });

  it('疑いの読み出しに失敗しても、報告の詳細の表示は止めない', async () => {
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/duplicates/report-1`, () => HttpResponse.error()),
    );
    renderApp();
    await login();
    await userEvent.click(await screen.findByTestId('report-row'));
    expect(await screen.findByTestId('detail-species')).toHaveTextContent('イノシシ');
    expect(screen.queryByTestId('duplicate-list')).not.toBeInTheDocument();
  });
});

describe('報告の詳細に成獣／幼獣・捕獲の方法・全身と尻尾の写真を表示する（AC2.9.4）', () => {
  it('依頼元が詳細を開くと、U2 で足した項目と写真がすべて表示される', async () => {
    server.use(
      ...baseHandlers(),
      http.get(`${API}/v1/duplicates/report-1`, () =>
        HttpResponse.json({ reportId: 'report-1', matches: [] }),
      ),
    );
    renderApp();
    await login();
    await userEvent.click(await screen.findByTestId('report-row'));
    expect(await screen.findByTestId('detail-age-class')).toHaveTextContent('成獣');
    expect(screen.getByTestId('detail-capture-method')).toHaveTextContent('わな');
    expect(screen.getAllByTestId('report-photo')).toHaveLength(2);
  });
});
