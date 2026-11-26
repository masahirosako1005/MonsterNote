// GET /v1/admin/settings（UC25の1。管理者の画面用）。role=adminのJWT経由（内部の呼び出しとは別の道）。
import { getCaller, requireRole } from '../shared/auth';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { SettingsRepository } from './repository';
import { withDefaults } from './validate';

export interface GetSettingsDeps {
  repo: SettingsRepository;
  now?: () => Date;
}

export function createGetSettingsRoute(deps: GetSettingsDeps): RouteHandler {
  return async (event) => {
    requireRole(getCaller(event), 'admin'); // 管理者だけ（US6.4。U4）
    const record = withDefaults(await deps.repo.get(), deps.now);
    return json(
      200,
      {
        duplicateDistanceMeters: record.duplicateDistanceMeters,
        duplicateWindowHours: record.duplicateWindowHours,
        targetAreaNorth: record.targetAreaNorth,
        targetAreaSouth: record.targetAreaSouth,
        targetAreaEast: record.targetAreaEast,
        targetAreaWest: record.targetAreaWest,
        updatedByAccountId: record.updatedByAccountId,
        updatedAt: record.updatedAt,
      },
      requestIdOf(event),
    );
  };
}
