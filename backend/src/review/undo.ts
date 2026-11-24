// 取り消し（C3 POST /v1/reviews/{reportId}/decision/undo）。
// BR3.9: 「確認中でない」「本人」「期限内」を条件にした 1 回の書き換えで戻す。成功しなかったときだけ記録を
// 読み直し、この順（すでに確認中→本人でない→期限切れ）で理由を判定する。D-6: ALREADY_UNDONE を追加。
// BR3.10: 確認の記録を消して確認中に戻す。BR3.13・reliability-design.md §2: 知らせはすぐ、1 回だけ試し、
// 結果を待たずに応答する（NFR2.14。承認・却下の「最大 3 回待つ」とは異なる届け方）。
import { randomUUID } from 'node:crypto';
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import {
  createEnvelope,
  publishEvent,
  type PublishOptions,
  type ReviewStatusChangedData,
} from '../shared/events';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import { decidedByNameToRead } from './decided-by-name';
import { reviewNotReady, reviewView } from './decision';
import type { ReviewDecisionRecord, ReviewRepository } from './repository';

export interface UndoDeps {
  repo: ReviewRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
  publishOptions?: PublishOptions;
  /** 試験で、結果を待たない送信の完了を見届けるための呼び出し（本番では使わない） */
  onPublishSettled?: (result: 'sent' | 'failed') => void;
}

function alreadyUndone(status: ReviewDecisionRecord['status']) {
  return errors.conflict('ALREADY_UNDONE', 'すでに確認中に戻っています', { status });
}

function undoExpired(record: ReviewDecisionRecord) {
  return errors.conflict('UNDO_EXPIRED', '取り消せる期限を過ぎています', {
    status: record.status,
    decidedByName: record.decidedByName ? decidedByNameToRead(record.decidedByName) : undefined,
  });
}

export function createUndoRoutes(deps: UndoDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  /** NFR2.14・reliability-design.md §2: 1 回だけ試し、結果を待たず応答する（delaysMs は常に空） */
  function publishUndone(previous: ReviewDecisionRecord, changedAt: string, actor: string): void {
    const envelope = createEnvelope<ReviewStatusChangedData>({
      type: 'review.status-changed',
      source: 'Review',
      actorAccountId: actor,
      now: () => new Date(changedAt),
      newId,
      data: {
        reportId: previous.reportId,
        status: 'checking',
        previousStatus: previous.status as 'approved' | 'rejected',
        undone: true,
        changedAt,
      },
    });
    publishEvent(deps.eventBridge, deps.busName, envelope, {
      ...deps.publishOptions,
      delaysMs: [],
    })
      .then(() => {
        deps.onPublishSettled?.('sent');
        return deps.repo.markEventSent(previous.reportId);
      })
      .catch(() => {
        deps.logger.error('review.status-changed（取り消し）を送れなかった', {
          errorCode: 'EVENT_PUBLISH_FAILED',
          reportId: previous.reportId,
          eventId: envelope.eventId,
        });
        deps.onPublishSettled?.('failed');
      });
  }

  return {
    'POST /v1/reviews/{reportId}/decision/undo': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'requester');
      const requestId = requestIdOf(event);
      const reportId = event.pathParameters?.reportId;
      if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);

      const nowIso = now().toISOString();
      const previous = await deps.repo.undo(reportId, caller.accountId, nowIso);
      if (!previous) {
        // BR3.9: 読み直して、この順で理由を判定する
        const current = await deps.repo.get(reportId);
        if (!current) throw reviewNotReady();
        if (current.status === 'checking') throw alreadyUndone(current.status);
        if (current.decidedByAccountId !== caller.accountId) throw errors.forbidden();
        throw undoExpired(current);
      }

      const updated: ReviewDecisionRecord = {
        ...previous,
        status: 'checking',
        reason: undefined,
        reasonText: undefined,
        decidedByAccountId: undefined,
        decidedByName: undefined,
        decidedAt: undefined,
        undoUntil: undefined,
        lastEventAt: nowIso,
        eventSent: false,
      };
      // BR3.13: すぐ送る（結果は待たない）
      publishUndone(previous, nowIso, caller.accountId);
      return json(200, reviewView(updated), requestId);
    },
  };
}
