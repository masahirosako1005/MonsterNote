// 内部の呼び出し: 呼んだ人が仮のパスワードのままか（U4・BR11.4）。
// eligibility.ts の「報告できるハンターか」と同じ形の、Lambda の直接の呼び出し（ADR-011 ①。利用者の証明を転送）。
// Accounts 以外の関数（review・catalog・duplicate-detection・reporting・settings）がこれを呼ぶ。
import type { AccountsRepository } from './repository';

export interface CallerStatusRequest {
  kind: 'caller-status';
  caller: { sub: string; roles: string[] };
}

export interface CallerStatusResponse {
  mustChangePassword: boolean;
}

export function isCallerStatusRequest(event: unknown): event is CallerStatusRequest {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { kind?: unknown }).kind === 'caller-status'
  );
}

export async function checkCallerStatus(
  accounts: AccountsRepository,
  request: CallerStatusRequest,
): Promise<CallerStatusResponse> {
  const account = await accounts.getById(request.caller.sub);
  // アカウントが無い・無効なときは、この確認の役目（仮パスワードの足止め）の対象外とする。
  // 持ち主・有効性そのものの確認は、呼び出し元の通常の処理（owner・role の確認）が別に行う
  return { mustChangePassword: account?.mustChangePassword ?? false };
}
