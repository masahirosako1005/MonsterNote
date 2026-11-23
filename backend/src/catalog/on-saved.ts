// report.saved の受け手（ReportCatalog）。BR4.1: 一覧の行の内容を入れ、一覧に出す。2 回目の知らせは無視する。
import type { EventBridgeEvent } from 'aws-lambda';
import type { EventEnvelope, ReportSavedData } from '../shared/events';
import type { Logger } from '../shared/logger';
import type { ProcessedEvents } from '../shared/processed-events';
import type { CatalogRepository } from './repository';

export interface CatalogConsumerDeps {
  repo: CatalogRepository;
  processed: ProcessedEvents;
  logger: Logger;
}

export function createCatalogOnSaved(deps: CatalogConsumerDeps) {
  return async (event: EventBridgeEvent<string, EventEnvelope<ReportSavedData>>): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (!envelope.eventId || !data?.reportId || !data.submittedAt || !data.hunterAccountId) {
      throw new Error('report.saved の形が正しくない');
    }
    if (await deps.processed.isProcessed(envelope.eventId)) return;
    const applied = await deps.repo.applySaved(data, envelope.occurredAt);
    await deps.processed.markProcessed(envelope.eventId);
    deps.logger.info(applied ? '一覧の行を入れた' : '古い知らせを無視した', {
      eventId: envelope.eventId,
      reportId: data.reportId,
    });
  };
}
