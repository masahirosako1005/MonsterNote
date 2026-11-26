// me.ts（初回の手続きの共通API）の試験
import { describe, expect, it, vi } from 'vitest';
import { changePassword, getMe, registerHunterNumber, setConsent } from './me';
import type { ApiClient } from './client';

function fakeApi(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({
      accountId: 'a',
      role: 'hunter',
      displayName: 'A',
      mustChangePassword: false,
      consentRequired: false,
      hunterNumberRequired: false,
    }),
    post: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    del: vi.fn(),
  } as unknown as ApiClient;
}

describe('me.ts', () => {
  it('getMe は GET /v1/me を呼ぶ', async () => {
    const api = fakeApi();
    await getMe(api);
    expect(api.get).toHaveBeenCalledWith('/v1/me');
  });

  it('changePassword は PUT /v1/me/password を呼ぶ', async () => {
    const api = fakeApi();
    await changePassword(api, 'abcd1234');
    expect(api.put).toHaveBeenCalledWith('/v1/me/password', { password: 'abcd1234' });
  });

  it('setConsent は PUT /v1/me/consent を呼ぶ', async () => {
    const api = fakeApi();
    await setConsent(api, true);
    expect(api.put).toHaveBeenCalledWith('/v1/me/consent', { consented: true });
  });

  it('registerHunterNumber は PUT /v1/me/hunter-number を呼ぶ', async () => {
    const api = fakeApi();
    await registerHunterNumber(api, '123');
    expect(api.put).toHaveBeenCalledWith('/v1/me/hunter-number', { hunterNumber: '123' });
  });
});
