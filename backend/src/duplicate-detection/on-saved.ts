// report.saved の受け手（保存のあとの再判定。BR8.4・BR8.6・BR8.11）。
// 索引に自分を加えてから判定し、見つかった相手ごとに疑いを 2 行（自分→相手、相手→自分）作って知らせを送る。
import { randomUUID } from 'node:crypto';
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import type { EventBridgeEvent } from 'aws-lambda';
import {
  createEnvelope,
  EventPublishError,
  publishEvent,
  type DuplicateSuspectedData,
  type EventEnvelope,
  type PublishOptions,
  type ReportSavedData,
} from '../shared/events';
import type { Logger } from '../shared/logger';
import type { ProcessedEvents } from '../shared/processed-events';
import type { SettingRecord } from '../settings/repository';
import { findMatches, speciesDayKeyOf, suspicionIdOf } from './match';
import type {
  DuplicateRepository,
  DuplicateSuspicionRecord,
  ReportFootprintRecord,
} from './repository';

export interface DuplicateOnSavedDeps {
  repo: DuplicateRepository;
  processed: ProcessedEvents;
  logger: Logger;
  /** ADR-011 ②: Settings を部品の身元の証明で読む */
  readSettings: () => Promise<SettingRecord>;
  eventBridge: EventBridgeClient;
  busName: string;
  now?: () => Date;
  newId?: () => string;
  publishOptions?: PublishOptions;
}

async function publishSuspected(
  deps: DuplicateOnSavedDeps,
  row: DuplicateSuspicionRecord,
  now: () => Date,
  newId: () => string,
): Promise<void> {
  const envelope = createEnvelope<DuplicateSuspectedData>({
    type: 'duplicate.suspected',
    source: 'DuplicateDetection',
    now,
    newId,
    data: { reportId: row.reportId, matchedReportId: row.matchedReportId, kind: row.kind },
  });
  try {
    await publishEvent(deps.eventBridge, deps.busName, envelope, deps.publishOptions);
  } catch (err) {
    if (err instanceof EventPublishError) {
      deps.logger.error('duplicate.suspected を送れなかった', {
        errorCode: 'EVENT_PUBLISH_FAILED',
        reportId: row.reportId,
        eventId: envelope.eventId,
      });
    }
    // NFR10.16: 知らせが失われることは受け入れたリスク。判定自体は失敗にしない
  }
}

export function createDuplicateOnSaved(deps: DuplicateOnSavedDeps) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  return async (event: EventBridgeEvent<string, EventEnvelope<ReportSavedData>>): Promise<void> => {
    const envelope = event.detail;
    const data = envelope.data;
    if (
      !envelope.eventId ||
      !data?.reportId ||
      !data.species ||
      !data.capturedAt ||
      !data.location
    ) {
      throw new Error('report.saved の形が正しくない');
    }
    if (await deps.processed.isProcessed(envelope.eventId)) {
      deps.logger.info('処理済みの知らせ', { eventId: envelope.eventId });
      return;
    }

    // BR8.11: 却下の知らせが先に届いていれば、覚えた active をそのまま残す
    const existing = await deps.repo.getFootprint(data.reportId);
    const footprint: ReportFootprintRecord = {
      reportId: data.reportId,
      savedReceived: true,
      species: data.species,
      location: data.location,
      capturedAt: data.capturedAt,
      speciesDay: speciesDayKeyOf(data.species, data.capturedAt),
      active: existing?.active ?? true,
      hunterAccountId: data.hunterAccountId,
      addedAt: existing?.addedAt ?? now().toISOString(),
      lastSavedEventAt: envelope.occurredAt,
      ...(existing?.lastStatusEventAt ? { lastStatusEventAt: existing.lastStatusEventAt } : {}),
    };
    await deps.repo.putFootprint(footprint);

    const settings = await deps.readSettings();
    const matches = await findMatches(
      deps.repo,
      {
        species: data.species,
        capturedAt: data.capturedAt,
        location: data.location,
        excludeReportId: data.reportId,
      },
      settings,
    );

    const kind = 'place-time' as const;
    for (const match of matches) {
      const detectedAt = now().toISOString();
      const forward: DuplicateSuspicionRecord = {
        suspicionId: suspicionIdOf(data.reportId, match.footprint.reportId, kind),
        reportId: data.reportId,
        matchedReportId: match.footprint.reportId,
        kind,
        distanceMeters: Math.round(match.distanceMeters),
        hoursApart: match.hoursApart,
        phase: 'post-save',
        detectedAt,
      };
      const backward: DuplicateSuspicionRecord = {
        suspicionId: suspicionIdOf(match.footprint.reportId, data.reportId, kind),
        reportId: match.footprint.reportId,
        matchedReportId: data.reportId,
        kind,
        distanceMeters: Math.round(match.distanceMeters),
        hoursApart: match.hoursApart,
        phase: 'post-save',
        detectedAt,
      };
      // BR8.6: 同じ組は作り直さない。作れたとき（初めて）だけ知らせを送る
      if (await deps.repo.putSuspicionIfAbsent(forward))
        await publishSuspected(deps, forward, now, newId);
      if (await deps.repo.putSuspicionIfAbsent(backward))
        await publishSuspected(deps, backward, now, newId);
    }

    await deps.processed.markProcessed(envelope.eventId);
    deps.logger.info('保存後の重複判定を終えた', {
      eventId: envelope.eventId,
      reportId: data.reportId,
    });
  };
}
