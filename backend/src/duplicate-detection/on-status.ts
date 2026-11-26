// review.status-changed の受け手（却下・取り消しによる索引の出し入れ。BR8.7・BR8.11）。
// 却下が report.saved より先に届くことがあるため、索引の行がなければ「状態だけを先に覚える」行を作る。
import type { EventBridgeEvent } from 'aws-lambda';
import type { EventEnvelope, ReviewStatusChangedData } from '../shared/events';
import type { Logger } from '../shared/logger';
import type { ProcessedEvents } from '../shared/processed-events';
import type { DuplicateRepository, ReportFootprintRecord } from './repository';

const STATUSES = ['checking', 'approved', 'rejected'] as const;

export interface DuplicateOnStatusDeps {
  repo: DuplicateRepository;
  processed: ProcessedEvents;
  logger: Logger;
  now?: () => Date;
}

export function createDuplicateOnStatus(deps: DuplicateOnStatusDeps) {
  const now = deps.now ?? (() => new Date());

  return async (
    event: EventBridgeEvent<string, EventEnvelope<ReviewStatusChangedData>>,
  ): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (!envelope.eventId || !data?.reportId || !STATUSES.includes(data.status)) {
      throw new Error('review.status-changed の形が正しくない');
    }
    if (await deps.processed.isProcessed(envelope.eventId)) return;

    const existing = await deps.repo.getFootprint(data.reportId);
    // contract-summary 2.5: 覚えている時刻より古い知らせは無視する
    if (existing?.lastStatusEventAt && existing.lastStatusEventAt > envelope.occurredAt) {
      await deps.processed.markProcessed(envelope.eventId);
      deps.logger.info('古い知らせを無視した', {
        eventId: envelope.eventId,
        reportId: data.reportId,
      });
      return;
    }

    const active = data.status !== 'rejected';
    const footprint: ReportFootprintRecord = existing
      ? { ...existing, active, lastStatusEventAt: envelope.occurredAt }
      : {
          reportId: data.reportId,
          // BR8.11: 種類・場所・捕獲日時はまだ入れない（索引から引かれない。report.saved を待つ）
          savedReceived: false,
          active,
          addedAt: now().toISOString(),
          lastStatusEventAt: envelope.occurredAt,
        };
    await deps.repo.putFootprint(footprint);
    await deps.processed.markProcessed(envelope.eventId);
    deps.logger.info('索引の active を更新した', {
      eventId: envelope.eventId,
      reportId: data.reportId,
    });
  };
}
