// 承認（C3 PUT /v1/reviews/{reportId}/decision）。
// BR3.2: 依頼元だけ。BR3.7: 記録がまだなければ 404 REVIEW_NOT_READY。BR3.3: 確認中のときだけ（条件付きの書き込み）。
// BR3.4: 確認した人と日時を記録し review.status-changed を送る（最大 3 回、送れたら eventSent を「済み」）。
// 同じ依頼元の送り直しは 200 で、知らせが「まだ」なら送り直す（reliability-design）。
import { randomUUID } from 'node:crypto';
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import {
  createEnvelope,
  EventPublishError,
  publishEvent,
  type PublishOptions,
  type ReviewStatusChangedData,
} from '../shared/events';
import { json, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import type { ReviewDecisionRecord, ReviewRepository } from './repository';

export const REVIEW_NOT_READY_MESSAGE =
  'まだ確認の準備ができていません。少し待ってからもう一度押してください';

export interface DecisionDeps {
  repo: ReviewRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
  publishOptions?: PublishOptions;
}

export const reviewNotReady = () => errors.notFound(REVIEW_NOT_READY_MESSAGE, 'REVIEW_NOT_READY');

export function reviewView(record: ReviewDecisionRecord) {
  return {
    reportId: record.reportId,
    status: record.status,
    ...(record.decidedByName ? { decidedByName: record.decidedByName } : {}),
    ...(record.decidedAt ? { decidedAt: record.decidedAt } : {}),
  };
}

function alreadyDecided(record: ReviewDecisionRecord | undefined) {
  return errors.conflict('ALREADY_DECIDED', 'すでに確認済みです', {
    decision: record?.status,
    decidedByName: record?.decidedByName,
    decidedAt: record?.decidedAt,
  });
}

export function createDecisionRoutes(deps: DecisionDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  async function publishApproved(record: ReviewDecisionRecord, actor: string, requestId: string) {
    const changedAt = record.decidedAt ?? now().toISOString();
    const envelope = createEnvelope<ReviewStatusChangedData>({
      type: 'review.status-changed',
      source: 'Review',
      actorAccountId: actor,
      // 知らせの occurredAt は承認の時刻（一覧は新しいものだけを反映する。BR4.1）
      now: () => new Date(changedAt),
      newId,
      data: {
        reportId: record.reportId,
        status: 'approved',
        previousStatus: 'checking',
        changedAt,
      },
    });
    try {
      await publishEvent(deps.eventBridge, deps.busName, envelope, deps.publishOptions);
    } catch (err) {
      if (err instanceof EventPublishError) {
        deps.logger.error('review.status-changed を送れなかった', {
          requestId,
          errorCode: 'EVENT_PUBLISH_FAILED',
          reportId: record.reportId,
          eventId: envelope.eventId,
        });
      }
      throw errors.internal('承認を記録できませんでした。もう一度お試しください');
    }
    await deps.repo.markEventSent(record.reportId);
  }

  return {
    'PUT /v1/reviews/{reportId}/decision': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'requester');
      const requestId = requestIdOf(event);
      const reportId = event.pathParameters?.reportId;
      if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);
      const body = parseJsonBody(event);
      if (body.decision !== 'approved') {
        // 却下は U3 で作る
        throw errors.validation([{ field: 'decision', reason: 'unsupported' }]);
      }

      const current = await deps.repo.get(reportId);
      if (!current) throw reviewNotReady();
      if (current.status === 'approved' && current.decidedByAccountId === caller.accountId) {
        if (!current.eventSent) await publishApproved(current, caller.accountId, requestId);
        return json(200, reviewView(current), requestId);
      }
      if (current.status !== 'checking') throw alreadyDecided(current);

      const decidedAt = now().toISOString();
      const decidedByName = caller.name ?? caller.accountId;
      if (!(await deps.repo.approve(reportId, caller.accountId, decidedByName, decidedAt))) {
        // 先にほかの依頼元が確認した
        throw alreadyDecided(await deps.repo.get(reportId));
      }
      const approved: ReviewDecisionRecord = {
        ...current,
        status: 'approved',
        decidedByAccountId: caller.accountId,
        decidedByName,
        decidedAt,
        lastEventAt: decidedAt,
        eventSent: false,
      };
      await publishApproved(approved, caller.accountId, requestId);
      return json(200, reviewView(approved), requestId);
    },
  };
}
