// 報告の作成に必要な設定の読み出し（C2 GET /v1/report-settings。ハンター。ADR-010）。
// 画面向けに対象地域だけを返す（BR9.1: ログイン済みの利用者の証明を転送して Settings を読む）。
import { getCaller, requireRole } from '../shared/auth';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { SettingsClient } from './internal-clients';

export interface ReportSettingsDeps {
  settings: SettingsClient;
}

export function createReportSettingsRoutes(deps: ReportSettingsDeps): Record<string, RouteHandler> {
  return {
    'GET /v1/report-settings': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter');
      const settings = await deps.settings(caller);
      return json(
        200,
        {
          targetArea: {
            north: settings.targetAreaNorth,
            south: settings.targetAreaSouth,
            east: settings.targetAreaEast,
            west: settings.targetAreaWest,
          },
        },
        requestIdOf(event),
      );
    },
  };
}
