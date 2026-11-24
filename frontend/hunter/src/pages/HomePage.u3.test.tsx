// U3: ホーム（自分の一覧）の日数の文章（AC5.3.1・AC5.3.2）。催促はしない（AC5.3.3）。
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, server } from '../../../test/msw-server';
import { sessionHandlers } from '../../../test/api-fixtures';
import { HunterApp } from '../App';

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

describe('HomePage（U3: 確認待ちの日数）', () => {
  it('送ってから n 日を表示し、7 日を超えたら依頼元へ連絡を促す文章を出す（メールや通知は送らない）', async () => {
    server.use(
      ...sessionHandlers('hunter'),
      http.get(`${API}/v1/catalog/my-reports`, () =>
        HttpResponse.json({
          items: [
            {
              reportId: 'report-1',
              species: 'boar',
              capturedAt: '2026-11-16T03:00:00.000Z',
              submittedAt: '2026-11-16T03:00:00.000Z',
              status: 'checking',
              daysSinceSubmitted: 8,
              waitingOverSevenDays: true,
            },
          ],
          nextCursor: null,
          totalCount: 1,
        }),
      ),
    );
    renderApp();
    await login();
    expect(await screen.findByTestId('waiting-days')).toHaveTextContent('送ってから 8 日');
    expect(screen.getByTestId('waiting-over-seven-message')).toHaveTextContent(
      '依頼元の確認に時間がかかっています',
    );
    // 印（badge）ではなく文章（message）で出す。メール・通知の仕組みは作っていない（AC5.3.3）
    expect(screen.queryByTestId('waiting-over-seven')).toBeNull();
  });
});
