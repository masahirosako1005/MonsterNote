// 仮のパスワードのままは PUT /v1/me/password・GET /v1/me 以外を拒む試験（BR11.4）
import { describe, expect, it, vi } from 'vitest';
import { createHttpHandler, json } from './http';
import { createLogger } from './logger';
import { apiEvent } from '../../test/helpers/events';
import { isPasswordGateExempt } from './require-password-changed';

const silent = createLogger('test', () => undefined);
const okRoutes = {
  'PUT /v1/me/password': async () => json(200, { ok: true }, 'r'),
  'GET /v1/me': async () => json(200, { ok: true }, 'r'),
  'POST /v1/reports': async () => json(201, { ok: true }, 'r'),
  'POST /v1/session': async () => json(200, { ok: true }, 'r'),
};

describe('isPasswordGateExempt', () => {
  it('PUT /v1/me/password と GET /v1/me だけ対象外', () => {
    expect(isPasswordGateExempt('PUT /v1/me/password')).toBe(true);
    expect(isPasswordGateExempt('GET /v1/me')).toBe(true);
    expect(isPasswordGateExempt('POST /v1/reports')).toBe(false);
  });
});

describe('createHttpHandler の passwordGate', () => {
  it('仮のパスワードのままだと対象外の道以外は 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const passwordGate = vi.fn().mockResolvedValue(true);
    const handler = createHttpHandler(okRoutes, silent, { passwordGate });
    const res = await handler(apiEvent({ routeKey: 'POST /v1/reports' }));
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body ?? '').code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('PUT /v1/me/password と GET /v1/me は仮のパスワードのままでも通す', async () => {
    const passwordGate = vi.fn().mockResolvedValue(true);
    const handler = createHttpHandler(okRoutes, silent, { passwordGate });
    const res1 = await handler(apiEvent({ routeKey: 'PUT /v1/me/password' }));
    const res2 = await handler(apiEvent({ routeKey: 'GET /v1/me' }));
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(passwordGate).not.toHaveBeenCalled();
  });

  it('証明がない道（ログインなど）は確認しない', async () => {
    const passwordGate = vi.fn().mockResolvedValue(true);
    const handler = createHttpHandler(okRoutes, silent, { passwordGate });
    const res = await handler(apiEvent({ routeKey: 'POST /v1/session', claims: undefined }));
    expect(res.statusCode).toBe(200);
    expect(passwordGate).not.toHaveBeenCalled();
  });

  it('mustChangePassword=false なら通す', async () => {
    const passwordGate = vi.fn().mockResolvedValue(false);
    const handler = createHttpHandler(okRoutes, silent, { passwordGate });
    const res = await handler(apiEvent({ routeKey: 'POST /v1/reports' }));
    expect(res.statusCode).toBe(201);
  });

  it('passwordGate を渡さなければ、これまでどおり確認しない（既存の関数に影響しない）', async () => {
    const handler = createHttpHandler(okRoutes, silent);
    const res = await handler(apiEvent({ routeKey: 'POST /v1/reports' }));
    expect(res.statusCode).toBe(201);
  });
});
