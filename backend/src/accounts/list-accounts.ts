// GET /v1/admin/accounts（BR11.9の一覧。D-4）。role・status を返す（有効な管理者の数の判定に要る）。
// 読み出しのついでに AdminCounter のずれを数え直して直す（reliability-design.md §1。専用の監視・定期実行は作らない）。
import { getCaller, requireRole } from '../shared/auth';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { AdminCounterRepository } from './admin-counter';
import type { AccountsRepository } from './repository';

export interface ListAccountsDeps {
  accounts: AccountsRepository;
  adminCounter: AdminCounterRepository;
  now?: () => Date;
}

function view(a: Awaited<ReturnType<AccountsRepository['list']>>[number]) {
  return {
    accountId: a.accountId,
    loginId: a.loginId,
    displayName: a.displayName,
    role: a.role,
    status: a.status,
    ...(a.organization ? { organization: a.organization } : {}),
  };
}

export function createListAccountsRoute(deps: ListAccountsDeps): RouteHandler {
  return async (event) => {
    requireRole(getCaller(event), 'admin'); // 管理者だけ（BR11.1。U4）
    const all = await deps.accounts.list();
    const actualActiveAdmins = all.filter(
      (a) => a.role === 'admin' && a.status === 'active',
    ).length;
    const now = (deps.now ?? (() => new Date()))().toISOString();
    // 一覧の応答を遅らせない範囲の、数件の追加の読み出し・書き込み（performance-design.md §1）
    await deps.adminCounter.reconcile(actualActiveAdmins, now);
    return json(200, { items: all.map(view) }, requestIdOf(event));
  };
}
