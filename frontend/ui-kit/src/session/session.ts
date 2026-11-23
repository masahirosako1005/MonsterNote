// ログインの状態（証明と出し直し用の値）を持つ（security-design: 出し直し用の値は localStorage、証明はメモリだけ）。
// 証明の期限（1 時間）の 1 分前に、出し直し用の値で新しい証明を受け取る（UC1 の 4、BR1.5）。
import { ApiError, createApiClient, type ApiClient } from '../api/client';
import type { Role } from './roles';

export interface SessionAccount {
  accountId: string;
  role: Role;
  displayName: string;
  organization?: string;
}

interface TokenResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  account: SessionAccount;
}

export interface SessionStoreOptions {
  baseUrl: string;
  requiredRole: Role;
  storage?: Storage;
  fetchFn?: typeof fetch;
  onChange?: (account: SessionAccount | undefined) => void;
}

const ROLE_MESSAGES: Record<Role, string> = {
  hunter: 'この画面はハンターの方だけが使えます',
  requester: 'この画面は依頼元の方だけが使えます',
  admin: 'この画面は管理者の方だけが使えます',
};

export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore(options: SessionStoreOptions) {
  const storage = options.storage ?? window.localStorage;
  const storageKey = `monsternote.${options.requiredRole}.refreshToken`;
  let idToken: string | undefined;
  let account: SessionAccount | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshing: Promise<boolean> | undefined;

  const api: ApiClient = createApiClient({
    baseUrl: options.baseUrl,
    fetchFn: options.fetchFn,
    getToken: () => idToken,
    onUnauthorized: () => refresh(),
  });

  function readStored(): string | undefined {
    try {
      return storage.getItem(storageKey) ?? undefined;
    } catch {
      return undefined;
    }
  }

  function clear() {
    idToken = undefined;
    account = undefined;
    if (timer) clearTimeout(timer);
    try {
      storage.removeItem(storageKey);
    } catch {
      // 保存場所が使えないときは消すものもない
    }
    options.onChange?.(undefined);
  }

  function accept(res: TokenResponse) {
    if (res.account.role !== options.requiredRole) {
      throw new Error(ROLE_MESSAGES[options.requiredRole]);
    }
    idToken = res.idToken;
    account = res.account;
    try {
      storage.setItem(storageKey, res.refreshToken);
    } catch {
      // 保存できなくてもこの画面の間はログインのまま使える
    }
    if (timer) clearTimeout(timer);
    const ms = Math.max(res.expiresIn - 60, 30) * 1000;
    timer = setTimeout(() => void refresh(), ms);
    options.onChange?.(account);
  }

  async function refresh(): Promise<boolean> {
    if (refreshing) return refreshing;
    const refreshToken = readStored();
    if (!refreshToken) return false;
    refreshing = (async () => {
      try {
        accept(await api.post<TokenResponse>('/v1/session/refresh', { refreshToken }, true));
        return true;
      } catch {
        clear();
        return false;
      } finally {
        refreshing = undefined;
      }
    })();
    return refreshing;
  }

  return {
    api,
    get account() {
      return account;
    },
    async login(loginId: string, password: string): Promise<SessionAccount> {
      const res = await api.post<TokenResponse>('/v1/session', { loginId, password }, true);
      accept(res);
      return res.account;
    },
    /** 保存した出し直し用の値でログインを続ける */
    restore: refresh,
    async logout(): Promise<void> {
      const refreshToken = readStored();
      try {
        if (refreshToken && idToken) await api.del('/v1/session', { refreshToken });
      } catch (err) {
        // 通信できなくても、この端末からは証明を捨てる（取り消しはサーバーの期限で切れる）
        if (!(err instanceof ApiError)) throw err;
      } finally {
        clear();
      }
    },
    dispose() {
      if (timer) clearTimeout(timer);
    },
  };
}
