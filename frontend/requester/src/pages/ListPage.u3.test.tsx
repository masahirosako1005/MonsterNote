// U3: 一覧の絞り込み（UC18。BR4.5・BR4.8。AC4.1.2）
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, server } from '../../../test/msw-server';
import { listItem, sessionHandlers } from '../../../test/api-fixtures';
import { RequesterApp } from '../App';

function renderApp(path = '/login') {
  return render(<RequesterApp config={{ apiBaseUrl: API }} initialPath={path} />);
}

async function login() {
  await userEvent.type(await screen.findByTestId('login-id'), 'city01');
  await userEvent.type(screen.getByTestId('login-password'), 'pass1234');
  await userEvent.click(screen.getByTestId('login-submit'));
}

describe('ListPage（U3: 絞り込み）', () => {
  it('状態のトグルを押すと、status クエリを付けて読み直す（複数選択可能なトグルボタン）', async () => {
    let lastQuery = '';
    server.use(
      ...sessionHandlers('requester'),
      http.get(`${API}/v1/catalog/reports`, ({ request }) => {
        lastQuery = new URL(request.url).search;
        const status = new URL(request.url).searchParams.get('status');
        return HttpResponse.json({
          items: status ? [listItem(1, 'approved')] : [listItem(1), listItem(2, 'approved')],
          nextCursor: null,
          totalCount: status ? 1 : 2,
        });
      }),
    );
    renderApp();
    await login();
    expect(await screen.findAllByTestId('report-row')).toHaveLength(2);
    await userEvent.click(screen.getByTestId('filter-status-approved'));
    await waitFor(() => expect(screen.getAllByTestId('report-row')).toHaveLength(1));
    expect(lastQuery).toContain('status=approved');
  });

  it('status と flag を両方選べる。「条件を消す」で絞り込みを解除する', async () => {
    server.use(
      ...sessionHandlers('requester'),
      http.get(`${API}/v1/catalog/reports`, ({ request }) => {
        const url = new URL(request.url);
        const hasFilter = url.searchParams.has('status') || url.searchParams.has('flag');
        return HttpResponse.json({
          items: hasFilter ? [] : [listItem(1)],
          nextCursor: null,
          totalCount: hasFilter ? 0 : 1,
        });
      }),
    );
    renderApp();
    await login();
    expect(await screen.findAllByTestId('report-row')).toHaveLength(1);
    await userEvent.click(screen.getByTestId('filter-status-checking'));
    await userEvent.click(screen.getByTestId('filter-flag-duplicate'));
    expect(await screen.findByTestId('report-list-empty')).toHaveTextContent(
      '条件に合う報告はありません',
    );
    await userEvent.click(screen.getByTestId('filter-clear'));
    expect(await screen.findAllByTestId('report-row')).toHaveLength(1);
  });

  it('読む上限に達したときは「全 2,000 件以上」と表示する（BR4.8・D-1）', async () => {
    server.use(
      ...sessionHandlers('requester'),
      http.get(`${API}/v1/catalog/reports`, () =>
        HttpResponse.json({
          items: [listItem(1, 'approved')],
          nextCursor: null,
          totalCount: 850,
          totalCountHasMore: true,
        }),
      ),
    );
    renderApp();
    await login();
    // ログイン後の画面遷移・初回の一覧読み出しが終わるまで待ってから操作する
    await userEvent.click(await screen.findByTestId('filter-status-approved'));
    expect(await screen.findByTestId('report-list-total')).toHaveTextContent('全 2,000 件以上');
  });

  it('0 件（絞り込みなし）のときは「報告はまだありません」のまま', async () => {
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
});
