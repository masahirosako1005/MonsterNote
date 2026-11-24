// ハンターの画面の U2 の振る舞い（種類の自動判別の表示・重複の確認ダイアログ。BR6.4・BR7.1・BR7.2・BR7.4）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API, server } from '../../test/msw-server';
import { reportSettingsHandler, sessionHandlers } from '../../test/api-fixtures';
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

function photoHandlers(detection: { outcome: string; species?: string; confidence?: number }) {
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
      HttpResponse.json({ photoId: 'photo-1', uploadStatus: 'uploaded', detection }),
    ),
  ];
}

const emptyList = () =>
  http.get(`${API}/v1/catalog/my-reports`, () =>
    HttpResponse.json({ items: [], nextCursor: null, totalCount: 0 }),
  );

async function uploadPhoto() {
  await userEvent.click(await screen.findByTestId('start-report'));
  const file = new File(['x'], 'body.jpg', { type: 'image/jpeg' });
  await userEvent.upload(await screen.findByTestId('photo-input'), file);
}

describe('種類の自動判別の表示（BR6.4）', () => {
  it('判別できたときは、その種類を選んだ状態にして次へ進める。直せる', async () => {
    server.use(
      ...sessionHandlers('hunter'),
      reportSettingsHandler(),
      ...photoHandlers({ outcome: 'detected', species: 'boar', confidence: 92 }),
      emptyList(),
    );
    renderApp('/login');
    await login();
    await uploadPhoto();
    expect(await screen.findByTestId('detection-result')).toHaveTextContent('イノシシ（92%）');
    await userEvent.click(screen.getByTestId('photo-next'));
    // BR6.4: 判別できた種類が選ばれた状態（aria-checked=true）。ハンターは選び直せる
    expect(await screen.findByTestId('species-boar')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByTestId('species-deer'));
    expect(screen.getByTestId('species-deer')).toHaveAttribute('aria-checked', 'true');
  });

  it('判別できなかったときは「手で選んでください」とし、何も選ばれていない', async () => {
    server.use(
      ...sessionHandlers('hunter'),
      reportSettingsHandler(),
      ...photoHandlers({ outcome: 'undetected' }),
      emptyList(),
    );
    renderApp('/login');
    await login();
    await uploadPhoto();
    expect(await screen.findByTestId('detection-result')).toHaveTextContent(
      '判別できませんでした。手で選んでください',
    );
    await userEvent.click(screen.getByTestId('photo-next'));
    expect(await screen.findByTestId('species-boar')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('species-deer')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('重複の確認ダイアログ（BR7.1・BR7.2・BR7.4）', () => {
  async function goToSubmit() {
    await uploadPhoto();
    await userEvent.click(await screen.findByTestId('photo-next'));
    await userEvent.click(await screen.findByTestId('species-boar'));
    await userEvent.click(screen.getByTestId('sex-male'));
    await userEvent.click(screen.getByTestId('choice-next'));
    await screen.findByTestId('map-tiles');
  }

  it('409 DUPLICATE_SUSPECTED で確認ダイアログを出し、「別の個体なので送る」で送り直す', async () => {
    let calls = 0;
    server.use(
      ...sessionHandlers('hunter'),
      reportSettingsHandler(),
      ...photoHandlers({ outcome: 'undetected' }),
      emptyList(),
      http.post(`${API}/v1/reports`, async ({ request }) => {
        calls += 1;
        const body = (await request.json()) as { confirmedNotDuplicate: boolean };
        if (calls === 1 && !body.confirmedNotDuplicate) {
          return HttpResponse.json(
            {
              code: 'DUPLICATE_SUSPECTED',
              message: 'x',
              conflict: {
                matches: [
                  { species: 'boar', capturedAt: '2026-11-20T03:00:00.000Z', distanceMeters: 300 },
                ],
              },
            },
            { status: 409 },
          );
        }
        return HttpResponse.json({ reportId: 'report-new' }, { status: 201 });
      }),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    await userEvent.click(screen.getByTestId('submit-report'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('イノシシ');
    await userEvent.click(screen.getByTestId('duplicate-confirm'));
    await screen.findByTestId('report-done');
    expect(calls).toBe(2);
  });

  it('「送るのをやめる」を確かめたうえでホームへ戻る', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      ...sessionHandlers('hunter'),
      reportSettingsHandler(),
      ...photoHandlers({ outcome: 'undetected' }),
      emptyList(),
      http.post(`${API}/v1/reports`, () =>
        HttpResponse.json(
          {
            code: 'DUPLICATE_SUSPECTED',
            message: 'x',
            conflict: {
              matches: [
                { species: 'boar', capturedAt: '2026-11-20T03:00:00.000Z', distanceMeters: 300 },
              ],
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    await userEvent.click(screen.getByTestId('submit-report'));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByTestId('duplicate-cancel'));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByTestId('start-report')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

describe('対象地域の読み出し（ADR-010・BR2.16）', () => {
  async function goToSubmit() {
    await uploadPhoto();
    await userEvent.click(await screen.findByTestId('photo-next'));
    await userEvent.click(await screen.findByTestId('species-boar'));
    await userEvent.click(screen.getByTestId('sex-male'));
    await userEvent.click(screen.getByTestId('choice-next'));
    await screen.findByTestId('map-tiles');
  }

  it('地図の既定の位置が対象地域の外なら警告を出す', async () => {
    server.use(
      ...sessionHandlers('hunter'),
      // 対象地域を沖縄付近だけに絞り、地図の既定の中心（本州付近）を対象地域の外にする
      reportSettingsHandler({ north: 26, south: 24, east: 128, west: 126 }),
      ...photoHandlers({ outcome: 'undetected' }),
      emptyList(),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    expect(await screen.findByTestId('map-outside-area')).toHaveTextContent('対象地域の外です');
  });

  it('地図の既定の位置が対象地域の中なら警告を出さない', async () => {
    server.use(
      ...sessionHandlers('hunter'),
      reportSettingsHandler(), // 既定: 日本のおおよその範囲
      ...photoHandlers({ outcome: 'undetected' }),
      emptyList(),
    );
    renderApp('/login');
    await login();
    await goToSubmit();
    await screen.findByTestId('map-tiles');
    expect(screen.queryByTestId('map-outside-area')).not.toBeInTheDocument();
  });
});

describe('作成をやめるときの確認（BR2.19）', () => {
  it('写真の画面の「やめる」は確かめてから消す。「いいえ」なら残る', async () => {
    server.use(...sessionHandlers('hunter'), reportSettingsHandler(), emptyList());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/login');
    await login();
    await userEvent.click(await screen.findByTestId('start-report'));
    await userEvent.click(screen.getByTestId('step-cancel'));
    expect(confirmSpy).toHaveBeenCalledWith('写真と入力内容は消えます。よろしいですか？');
    // 「いいえ」なので、まだ写真の画面のまま
    expect(screen.getByTestId('step-count')).toHaveTextContent('1/3');
    vi.restoreAllMocks();
  });

  it('種類と雌雄の画面の「やめる」は確かめてから、「はい」でホームに戻る', async () => {
    server.use(
      ...sessionHandlers('hunter'),
      reportSettingsHandler(),
      ...photoHandlers({ outcome: 'undetected' }),
      emptyList(),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/login');
    await login();
    await uploadPhoto();
    await userEvent.click(await screen.findByTestId('photo-next'));
    await userEvent.click(await screen.findByTestId('step-cancel'));
    expect(await screen.findByTestId('start-report')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
