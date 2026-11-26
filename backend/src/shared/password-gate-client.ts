// ほかの関数（review・catalog・duplicate-detection・reporting・settings）から Accounts への
// 内部の呼び出しで、仮のパスワードのままかを確かめる（U4・BR11.4）。ADR-011 ①（利用者の証明を転送）。
import type { LambdaClient } from '@aws-sdk/client-lambda';
import type { CallerStatusRequest, CallerStatusResponse } from '../accounts/caller-status';
import type { Caller } from './auth';
import { callerForwarded } from './internal-invoke';
import { invokeInternal } from './internal-invoke';

/** HttpHandlerOptions.passwordGate に渡す関数を作る */
export function createRemotePasswordGate(
  lambda: LambdaClient,
  accountsFunctionName: string,
): (caller: Caller) => Promise<boolean> {
  return async (caller) => {
    const request: CallerStatusRequest = {
      kind: 'caller-status',
      caller: callerForwarded(caller).caller,
    };
    const res = await invokeInternal<CallerStatusRequest, CallerStatusResponse>(
      lambda,
      accountsFunctionName,
      request,
    );
    return res.mustChangePassword;
  };
}
