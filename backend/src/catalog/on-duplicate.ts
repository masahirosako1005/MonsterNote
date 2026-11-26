// duplicate.suspected の受け手（ReportCatalog）。BR4.6・UC19: 重複の疑いの印を立てる。一度立てたら戻さない。
// 送り手は U2 の DuplicateDetection（契約 C14）。U3 は約束 C14 の形どおりの知らせで試す（U2 がまだなくてもよい）。
// U1 の report.saved／review.status-changed と同じ組み立て方（processedEventId で二重処理を防ぐ。reliability-design §3）。
import type { EventBridgeEvent } from 'aws-lambda';
import type { EventEnvelope } from '../shared/events';
import type { CatalogConsumerDeps } from './on-saved';

/** C14 duplicate.suspected の中身 */
export interface DuplicateSuspectedData {
  reportId: string;
  matchedReportId: string;
  kind: 'place-time' | 'photo' | 'moon-ring';
}

export function createCatalogOnDuplicate(deps: CatalogConsumerDeps) {
  return async (
    event: EventBridgeEvent<string, EventEnvelope<DuplicateSuspectedData>>,
  ): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (!envelope.eventId || !data?.reportId) {
      throw new Error('duplicate.suspected の形が正しくない');
    }
    if (await deps.processed.isProcessed(envelope.eventId)) {
      deps.logger.info('処理済みの知らせ', { eventId: envelope.eventId });
      return;
    }
    await deps.repo.applyDuplicate(data.reportId, envelope.occurredAt);
    await deps.processed.markProcessed(envelope.eventId);
    deps.logger.info('重複の疑いの印を立てた', {
      eventId: envelope.eventId,
      reportId: data.reportId,
    });
  };
}
