// 内部の呼び出し C10「報告できるハンターか」（BR2.1）。
// Reporting の関数から Lambda の直接の呼び出し（IAM）で呼ばれる。外の API の入口には出さない（NFR4.4）。
// 呼び出しの中身に利用者の sub と役割が入り、Accounts の側でも確かめる。
import type { AccountsRepository } from './repository';

export interface EligibilityRequest {
  kind: 'report-eligibility';
  accountId: string;
  caller: { sub: string; roles: string[] };
}

export type EligibilityResponse =
  { eligible: boolean; hunterNumber?: string; displayName?: string } | { error: 'FORBIDDEN' };

export function isEligibilityRequest(event: unknown): event is EligibilityRequest {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { kind?: unknown }).kind === 'report-eligibility'
  );
}

export async function checkReportEligibility(
  accounts: AccountsRepository,
  request: EligibilityRequest,
): Promise<EligibilityResponse> {
  // 利用者本人のハンターだけが、自分について問い合わせられる
  if (!request.caller.roles.includes('hunter') || request.caller.sub !== request.accountId) {
    return { error: 'FORBIDDEN' };
  }
  const account = await accounts.getById(request.accountId);
  if (!account || account.status !== 'active' || account.role !== 'hunter') {
    return account ? { eligible: false, displayName: account.displayName } : { eligible: false };
  }
  if (!account.consentedAt || !account.hunterNumber) {
    return { eligible: false, displayName: account.displayName };
  }
  return { eligible: true, hunterNumber: account.hunterNumber, displayName: account.displayName };
}
