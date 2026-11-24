// Reporting から Settings（C11）・DuplicateDetection（C9）を呼ぶ内部のクライアント。
// どちらも「その場の呼び出し」（画面の操作の続き）のため、利用者の証明をそのまま転送する（ADR-011 ①）。
import type { LambdaClient } from '@aws-sdk/client-lambda';
import type { TrimmedMatch } from '../duplicate-detection/response-shape';
import type { SettingRecord } from '../settings/repository';
import type { Caller } from '../shared/auth';
import { callerForwarded, invokeInternal } from '../shared/internal-invoke';
import type { GeoPoint, Species } from './repository';

export type SettingsClient = (caller: Caller) => Promise<SettingRecord>;

/** C11 GET /internal/v1/settings を Lambda の直接の呼び出しで呼ぶ（BR2.16・BR9.1） */
export function createSettingsClient(lambda: LambdaClient, functionName: string): SettingsClient {
  return (caller) =>
    invokeInternal(lambda, functionName, {
      kind: 'settings-read',
      auth: callerForwarded(caller),
    });
}

export interface DuplicateCheckInput {
  species: Species;
  capturedAt: string;
  location: GeoPoint;
}

export interface DuplicateCheckResult {
  suspected: boolean;
  matches: TrimmedMatch[];
}

export type DuplicateCheckClient = (
  caller: Caller,
  input: DuplicateCheckInput,
) => Promise<DuplicateCheckResult>;

/** C9 POST /internal/v1/duplicate-checks を Lambda の直接の呼び出しで呼ぶ（BR7.1） */
export function createDuplicateCheckClient(
  lambda: LambdaClient,
  functionName: string,
): DuplicateCheckClient {
  return (caller, input) =>
    invokeInternal(lambda, functionName, {
      kind: 'duplicate-check',
      auth: callerForwarded(caller),
      ...input,
    });
}
