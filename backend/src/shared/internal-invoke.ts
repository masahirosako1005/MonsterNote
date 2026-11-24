// 部品の間の直接の呼び出し（Lambda InvokeCommand）で使う、証明の種類の共通の形（ADR-011、contract-summary 2.1b）。
// その場の呼び出し（画面の操作の続き）は利用者の証明をそのまま転送し、知らせで動く処理は部品の身元の証明を使う。
// Settings 関数は、呼び出し元（Reporting は利用者の証明、DuplicateDetection は部品の身元の証明）ごとに
// この共通の形で証明の種類を見分ける（infrastructure-specification.md §2、security-design.md §2）。
import { InvokeCommand, type LambdaClient } from '@aws-sdk/client-lambda';
import type { Caller } from './auth';
import { withTimeout } from './events';

/** 部品の身元の証明を使ってよい部品（contract-summary 2.1b の表） */
export type ComponentIdentity = 'DuplicateDetection';

/** その場の呼び出し: 呼ぶ側が画面から受け取った利用者の証明をそのまま転送する（ADR-011 ①） */
export interface CallerForwarded {
  authKind: 'caller';
  caller: { sub: string; roles: string[] };
}

/** 知らせで動く処理など、利用者がいない呼び出し（ADR-011 ②。部品の身元の証明） */
export interface ComponentIdentified {
  authKind: 'component';
  component: ComponentIdentity;
}

export type InternalAuth = CallerForwarded | ComponentIdentified;

export function callerForwarded(caller: Caller): CallerForwarded {
  return { authKind: 'caller', caller: { sub: caller.accountId, roles: caller.roles } };
}

export function componentIdentity(component: ComponentIdentity): ComponentIdentified {
  return { authKind: 'component', component };
}

/** 2 秒で区切る（contract-summary 2.3。部品の間のその場の呼び出し） */
export const INTERNAL_CALL_TIMEOUT_MS = 2000;

/** Lambda の直接の呼び出し。時間切れ・失敗は呼ぶ側に投げる（やり直さない。contract-summary 2.3） */
export async function invokeInternal<TRequest extends object, TResponse>(
  lambda: LambdaClient,
  functionName: string,
  payload: TRequest,
  timeoutMs = INTERNAL_CALL_TIMEOUT_MS,
): Promise<TResponse> {
  const res = await withTimeout(
    lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      }),
    ),
    timeoutMs,
  );
  if (res.FunctionError || !res.Payload) {
    throw new Error(`内部の呼び出しの失敗: ${res.FunctionError ?? 'empty payload'}`);
  }
  return JSON.parse(new TextDecoder().decode(res.Payload)) as TResponse;
}
