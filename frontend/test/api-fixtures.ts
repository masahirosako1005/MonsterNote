// 画面の試験で使う API の応答（msw のハンドラー）
import { http, HttpResponse } from 'msw';
import { API } from './msw-server';

export const fakeIdToken = 'header.payload.sig';

export function sessionHandlers(role: 'hunter' | 'requester', displayName = '利用者') {
  return [
    http.post(`${API}/v1/session`, async ({ request }) => {
      const body = (await request.json()) as { loginId: string; password: string };
      if (body.password !== 'pass1234') {
        return HttpResponse.json(
          { code: 'UNAUTHENTICATED', message: 'ID かパスワードが違います' },
          { status: 401 },
        );
      }
      return HttpResponse.json({
        idToken: fakeIdToken,
        accessToken: 'access',
        refreshToken: 'refresh-1',
        expiresIn: 3600,
        account: { accountId: `${role}-a`, role, displayName },
        mustChangePassword: false,
        consentRequired: false,
        hunterNumberRequired: false,
      });
    }),
    http.post(`${API}/v1/session/refresh`, async ({ request }) => {
      const body = (await request.json()) as { refreshToken: string };
      if (body.refreshToken !== 'refresh-1') {
        return HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'x' }, { status: 401 });
      }
      return HttpResponse.json({
        idToken: fakeIdToken,
        accessToken: 'access',
        refreshToken: 'refresh-1',
        expiresIn: 3600,
        account: { accountId: `${role}-a`, role, displayName },
      });
    }),
    http.delete(`${API}/v1/session`, () => new HttpResponse(null, { status: 204 })),
    // U4: ログイン直後の初回の手続きの確認（BR11.7）。既定ではすべて済んでいる扱いにする
    http.get(`${API}/v1/me`, () =>
      HttpResponse.json({
        accountId: `${role}-a`,
        role,
        displayName,
        mustChangePassword: false,
        consentRequired: false,
        hunterNumberRequired: false,
      }),
    ),
  ];
}

/** U2（新規）: 対象地域（GET /v1/report-settings）。既定は日本のおおよその範囲 */
export function reportSettingsHandler(area = { north: 46, south: 20, east: 154, west: 122 }) {
  return http.get(`${API}/v1/report-settings`, () => HttpResponse.json({ targetArea: area }));
}

export function listItem(i: number, status = 'checking') {
  const at = new Date(Date.UTC(2026, 10, 23, 3, 0, 0) - i * 60_000).toISOString();
  return {
    reportId: `report-${i}`,
    hunterName: 'ハンター A',
    species: 'boar',
    capturedAt: at,
    placeName: null,
    status,
    duplicateSuspected: false,
    manualEntry: false,
    submittedAt: at,
  };
}
