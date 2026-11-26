// PUT /v1/admin/settings（UC25。BR9.2・BR9.4）。範囲を確かめ、updatedByAccountId・updatedAtを記録する。
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { publishAuditRecorded } from '../shared/events';
import { noContent, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import { SETTINGS_KEY, type SettingRecord, type SettingsRepository } from './repository';
import { validateSettingValues } from './validate';

export interface UpdateSettingsDeps {
  repo: SettingsRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
}

function num(body: Record<string, unknown>, field: string): number {
  const v = body[field];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw errors.unprocessable('VALIDATION_FAILED', `${field} を確かめてください`, [
      { field, reason: 'invalid' },
    ]);
  }
  return v;
}

export function createUpdateSettingsRoute(deps: UpdateSettingsDeps): RouteHandler {
  const now = deps.now ?? (() => new Date());
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（US6.4。U4）
    const body = parseJsonBody(event);
    const input = {
      duplicateDistanceMeters: num(body, 'duplicateDistanceMeters'),
      duplicateWindowHours: num(body, 'duplicateWindowHours'),
      targetAreaNorth: num(body, 'targetAreaNorth'),
      targetAreaSouth: num(body, 'targetAreaSouth'),
      targetAreaEast: num(body, 'targetAreaEast'),
      targetAreaWest: num(body, 'targetAreaWest'),
    };
    const problems = validateSettingValues(input);
    if (problems.length > 0) {
      throw errors.unprocessable('VALIDATION_FAILED', '範囲を確かめてください', problems);
    }
    const updatedAt = now().toISOString();
    const record: SettingRecord = {
      settingKey: SETTINGS_KEY,
      ...input,
      updatedByAccountId: caller.accountId,
      updatedAt,
    };
    await deps.repo.put(record);
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'Settings',
      {
        action: 'settings.updated',
        targetType: 'settings',
        outcome: 'succeeded',
        actorAccountId: caller.accountId,
        actorName: caller.name,
      },
      {
        actorAccountId: caller.accountId,
        now,
        newId: () => `settings.updated:${updatedAt}`,
        onError: (err, eventId) =>
          deps.logger.error('audit.recorded を送れなかった', {
            requestId: requestIdOf(event),
            errorCode: 'EVENT_PUBLISH_FAILED',
            eventId,
          }),
      },
    );
    return noContent(requestIdOf(event));
  };
}
