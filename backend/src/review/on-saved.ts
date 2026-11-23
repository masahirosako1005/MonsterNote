// report.saved の受け手（Review）。BR3.1: 確認中の記録を作る。同じ知らせの 2 回目は無視する（NFR10.4）。
import type { EventBridgeEvent } from 'aws-lambda';
import type { EventEnvelope, ReportSavedData } from '../shared/events';
import type { Logger } from '../shared/logger';
import type { ProcessedEvents } from '../shared/processed-events';
import type { ReviewRepository } from './repository';

export interface ReviewOnSavedDeps {
  repo: ReviewRepository;
  processed: ProcessedEvents;
  logger: Logger;
}

export function createReviewOnSaved(deps: ReviewOnSavedDeps) {
  return async (event: EventBridgeEvent<string, EventEnvelope<ReportSavedData>>): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (!envelope.eventId || !data?.reportId || !data.hunterAccountId) {
      throw new Error('report.saved の形が正しくない');
    }
    if (await deps.processed.isProcessed(envelope.eventId)) {
      deps.logger.info('処理済みの知らせ', { eventId: envelope.eventId });
      return;
    }
    const created = await deps.repo.createChecking({
      reportId: data.reportId,
      hunterAccountId: data.hunterAccountId,
      status: 'checking',
      submittedAt: data.submittedAt,
      lastEventAt: envelope.occurredAt,
      eventSent: true,
    });
    await deps.processed.markProcessed(envelope.eventId);
    deps.logger.info(created ? '確認中の記録を作った' : '記録はすでにある', {
      eventId: envelope.eventId,
      reportId: data.reportId,
    });
  };
}
