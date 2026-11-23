// apiClient の試験（証明を付ける、10 秒で時間切れ、requestId、共通のエラーの形、401 での出し直し）
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { API, server } from '../../../test/msw-server';
import { ApiError, createApiClient } from './client';

describe('createApiClient', () => {
  it('Bearer の証明を付けて JSON を送り、応答を返す', async () => {
    let auth: string | null = null;
    server.use(
      http.post(`${API}/v1/x`, async ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ echo: await request.json() });
      }),
    );
    const api = createApiClient({ baseUrl: API, getToken: () => 'tok' });
    await expect(api.post('/v1/x', { a: 1 })).resolves.toEqual({ echo: { a: 1 } });
    expect(auth).toBe('Bearer tok');
  });

  it('ログインの道（anonymous）には証明を付けない', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.post(`${API}/v1/session`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({});
      }),
    );
    await createApiClient({ baseUrl: API, getToken: () => 'tok' }).post('/v1/session', {}, true);
    expect(auth).toBeNull();
  });

  it('エラーは ApiError にし、code・message・conflict・問い合わせ番号を持たせる', async () => {
    server.use(
      http.put(`${API}/v1/y`, () =>
        HttpResponse.json(
          {
            code: 'ALREADY_DECIDED',
            message: 'すでに確認済みです',
            conflict: { decision: 'approved' },
          },
          { status: 409, headers: { 'x-request-id': 'req-7' } },
        ),
      ),
    );
    const err = await createApiClient({ baseUrl: API })
      .put('/v1/y')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      code: 'ALREADY_DECIDED',
      message: 'すでに確認済みです',
      requestId: 'req-7',
      conflict: { decision: 'approved' },
    });
  });

  it('10 秒（設定値）で時間切れにし、NETWORK のエラーにする', async () => {
    server.use(
      http.get(`${API}/v1/slow`, async () => {
        await delay(200);
        return HttpResponse.json({});
      }),
    );
    const err = await createApiClient({ baseUrl: API, timeoutMs: 20 })
      .get('/v1/slow')
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('401 なら出し直しを 1 回試し、成功したら呼び直す', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/v1/z`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'x' }, { status: 401 })
          : HttpResponse.json({ ok: true });
      }),
    );
    const onUnauthorized = vi.fn().mockResolvedValue(true);
    await expect(createApiClient({ baseUrl: API, onUnauthorized }).get('/v1/z')).resolves.toEqual({
      ok: true,
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('204 は undefined、形の分からないエラーは HTTP_ERROR', async () => {
    server.use(
      http.delete(`${API}/v1/d`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${API}/v1/e`, () => new HttpResponse('boom', { status: 502 })),
    );
    const api = createApiClient({ baseUrl: API });
    await expect(api.del('/v1/d')).resolves.toBeUndefined();
    await expect(api.get('/v1/e')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });
});
