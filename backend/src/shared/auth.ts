// 認可の共通の処理（BR1.2・BR1.4・NFR4.3）。
// 証明そのもの（署名・期限）は API Gateway の JWT オーソライザーが確かめる。
// 関数は呼ばれるたびに、証明の sub（利用者の ID）と cognito:groups（役割）を読み、役割と持ち主を確かめる。
import { errors } from './errors';

export type Role = 'hunter' | 'requester' | 'admin';

const KNOWN_ROLES: readonly Role[] = ['hunter', 'requester', 'admin'];

export interface Caller {
  accountId: string;
  roles: Role[];
  name?: string;
}

/** 証明の claims を持つイベントの最小の形 */
export interface EventWithClaims {
  requestContext: {
    authorizer?: { jwt?: { claims?: Record<string, string | number | boolean | string[]> } };
  };
}

/** cognito:groups は API Gateway で "[a b]" の文字列になる。配列の形も受ける */
function parseGroups(raw: unknown): Role[] {
  let names: string[] = [];
  if (Array.isArray(raw)) {
    names = raw.map(String);
  } else if (typeof raw === 'string') {
    names = raw
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(/[\s,]+/)
      .filter((s) => s.length > 0);
  }
  return names.filter((n): n is Role => (KNOWN_ROLES as readonly string[]).includes(n));
}

/** 呼んだ利用者を読む。証明がなければ 401 */
export function getCaller(event: EventWithClaims): Caller {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (!claims || typeof sub !== 'string' || sub.length === 0) {
    throw errors.unauthenticated();
  }
  const caller: Caller = { accountId: sub, roles: parseGroups(claims['cognito:groups']) };
  if (typeof claims.name === 'string') caller.name = claims.name;
  return caller;
}

export function hasRole(caller: Caller, role: Role): boolean {
  return caller.roles.includes(role);
}

/** 許された役割のどれかを持たなければ 403 */
export function requireRole(caller: Caller, ...allowed: Role[]): void {
  if (!allowed.some((role) => hasRole(caller, role))) {
    throw errors.forbidden();
  }
}

/** データの持ち主でなければ 403 */
export function requireOwner(caller: Caller, ownerAccountId: string): void {
  if (caller.accountId !== ownerAccountId) {
    throw errors.forbidden();
  }
}
