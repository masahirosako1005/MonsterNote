// audit.recorded の受け手（BR12.2〜BR12.4）。eventId を条件にした1回のPutItemで記録する
// （reliability-design.md §2）。同じ知らせを2回受けても2件目は何もしない。
// entryId は eventId をそのまま使う（DynamoDB の条件付き書き込みはパーティションキー自身の存在でしか
// 判定できないため、eventId をキーの外の属性のまま別の entryId を生成すると、毎回違う行になって
// 二重登録を防げない。entryId=eventId にすることで attribute_not_exists の条件がそのまま効く）。
import type { EventBridgeEvent } from 'aws-lambda';
import type { AuditRecordedData, EventEnvelope } from '../shared/events';
import type { Logger } from '../shared/logger';
import type { AuditLogRepository } from './repository';

export interface OnRecordedDeps {
  repo: AuditLogRepository;
  logger: Logger;
  now?: () => Date;
}

export function createOnRecorded(deps: OnRecordedDeps) {
  const now = deps.now ?? (() => new Date());

  return async (
    event: EventBridgeEvent<string, EventEnvelope<AuditRecordedData>>,
  ): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (!envelope.eventId || !data?.action || !data.targetType || !data.outcome) {
      throw new Error('audit.recorded の形が正しくない');
    }
    const created = await deps.repo.putIfAbsent({
      entryId: envelope.eventId,
      occurredAt: envelope.occurredAt,
      recordedAt: now().toISOString(),
      actorAccountId: data.actorAccountId ?? envelope.actorAccountId,
      actorName: data.actorName,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      outcome: data.outcome,
      detail: data.detail,
      eventId: envelope.eventId,
    });
    if (!created) {
      deps.logger.info('処理済みの知らせ（operation already recorded）', {
        eventId: envelope.eventId,
      });
      return;
    }
    deps.logger.info('操作の記録を作った', { eventId: envelope.eventId, action: data.action });
  };
}
