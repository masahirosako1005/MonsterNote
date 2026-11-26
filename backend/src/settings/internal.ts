// 設定の読み出しの内部の呼び出し（C11 GET /internal/v1/settings。BR9.1）。
// API Gateway の道は持たず、Lambda の直接の呼び出しだけで受ける（infrastructure-specification.md §2）。
import { errors } from '../shared/errors';
import type { InternalAuth } from '../shared/internal-invoke';
import type { SettingsRepository, SettingRecord } from './repository';
import { withDefaults } from './validate';

export interface SettingsReadRequest {
  kind: 'settings-read';
  auth: InternalAuth;
}

export function isSettingsReadRequest(event: unknown): event is SettingsReadRequest {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { kind?: unknown }).kind === 'settings-read'
  );
}

/**
 * BR9.1: ログイン済みの利用者（Reporting・画面からの利用者の証明の転送）か、
 * DuplicateDetection の部品の身元の証明だけを許す。それ以外は拒む
 */
function authorize(auth: InternalAuth): void {
  if (auth.authKind === 'caller') {
    if (!auth.caller.sub) throw errors.unauthenticated();
    return;
  }
  if (auth.component !== 'DuplicateDetection') throw errors.forbidden();
}

export async function readSettings(
  repo: SettingsRepository,
  request: SettingsReadRequest,
  now: () => Date = () => new Date(),
): Promise<SettingRecord> {
  authorize(request.auth);
  return withDefaults(await repo.get(), now);
}
