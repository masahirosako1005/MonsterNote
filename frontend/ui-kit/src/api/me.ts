// 初回の手続き（BR11.4〜BR11.7）。ハンター・依頼元・管理者のどの画面からも同じ形で呼ぶ。
import type { ApiClient } from './client';
import type { Role } from '../session/roles';

export interface MeView {
  accountId: string;
  role: Role;
  displayName: string;
  mustChangePassword: boolean;
  consentRequired: boolean;
  hunterNumberRequired: boolean;
}

export function getMe(api: ApiClient): Promise<MeView> {
  return api.get<MeView>('/v1/me');
}

export function changePassword(api: ApiClient, password: string): Promise<void> {
  return api.put('/v1/me/password', { password });
}

export function setConsent(api: ApiClient, consented: boolean): Promise<void> {
  return api.put('/v1/me/consent', { consented });
}

export function registerHunterNumber(api: ApiClient, hunterNumber: string): Promise<void> {
  return api.put('/v1/me/hunter-number', { hunterNumber });
}
