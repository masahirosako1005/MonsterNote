// review.status-changed の受け手（ReportCatalog）。BR4.1: 新しい知らせだけ状態を反映する。
// 保存の知らせより先に届いたら状態だけを覚え、report.saved が届いてから一覧に出す（contract-summary 2.5）。
import type { EventBridgeEvent } from 'aws-lambda';
import type { EventEnvelope, ReviewStatusChangedData } from '../shared/events';
import type { CatalogConsumerDeps } from './on-saved';

const STATUSES = ['checking', 'approved', 'rejected'] as const;

export function createCatalogOnStatus(deps: CatalogConsumerDeps) {
  return async (
    event: EventBridgeEvent<string, EventEnvelope<ReviewStatusChangedData>>,
  ): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (!envelope.eventId || !data?.reportId || !STATUSES.includes(data.status)) {
      throw new Error('review.status-changed の形が正しくない');
    }
    if (await deps.processed.isProcessed(envelope.eventId)) return;
    const applied = await deps.repo.applyStatus(data.reportId, data.status, envelope.occurredAt);
    await deps.processed.markProcessed(envelope.eventId);
    deps.logger.info(applied ? '状態を反映した' : '古い知らせを無視した', {
      eventId: envelope.eventId,
      reportId: data.reportId,
    });
  };
}
