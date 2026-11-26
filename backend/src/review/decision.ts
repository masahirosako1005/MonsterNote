// 承認・却下（C3 PUT /v1/reviews/{reportId}/decision）。
// BR3.2: 依頼元だけ。BR3.7: 記録がまだなければ 404 REVIEW_NOT_READY。BR3.3: 確認中のときだけ（条件付きの書き込み）。
// BR3.8: 却下には理由が必須（その他は 1〜200 文字の文も）。BR3.9: undoUntil = decidedAt + 10 秒。
// BR3.12: 確認した人の名前。BR3.13: review.status-changed を送る（最大 3 回、送れたら eventSent を「済み」）。
// 同じ依頼元の送り直しは 200 で、知らせが「まだ」なら送り直す（reliability-design）。
import { randomUUID } from 'node:crypto';
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import {
  createEnvelope,
  EventPublishError,
  publishAuditRecorded,
  publishEvent,
  type PublishOptions,
  type ReviewStatusChangedData,
} from '../shared/events';
import { json, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import { decidedByNameToRead, decidedByNameToWrite } from './decided-by-name';
import type { DecideInput, ReviewDecisionRecord, ReviewRepository } from './repository';
import { canShowUndo } from './undo-visibility';
import { validateReject } from './validate-reject';

export const REVIEW_NOT_READY_MESSAGE =
  'まだ確認の準備ができていません。少し待ってからもう一度押してください';

/** 確定から取り消せる猶予（BR3.9）。10 秒 */
export const UNDO_WINDOW_MS = 10_000;

export const reviewNotReady = () => errors.notFound(REVIEW_NOT_READY_MESSAGE, 'REVIEW_NOT_READY');

export interface ReviewViewOptions {
  /** BR3.15: 本人かつ期限内のときだけ undoUntil を含める */
  includeUndo?: boolean;
}

export function reviewView(record: ReviewDecisionRecord, options: ReviewViewOptions = {}) {
  return {
    reportId: record.reportId,
    status: record.status,
    ...(record.decidedByName ? { decidedByName: decidedByNameToRead(record.decidedByName) } : {}),
    ...(record.decidedAt ? { decidedAt: record.decidedAt } : {}),
    // BR3.14: 却下の理由はハンターにも見せる（その他のときは文も）
    ...(record.status === 'rejected' && record.reason ? { reason: record.reason } : {}),
    ...(record.status === 'rejected' && record.reasonText ? { reasonText: record.reasonText } : {}),
    ...(options.includeUndo && record.undoUntil ? { undoUntil: record.undoUntil } : {}),
  };
}

export function alreadyDecided(record: ReviewDecisionRecord | undefined) {
  return errors.conflict('ALREADY_DECIDED', 'すでに確認済みです', {
    decision: record?.status,
    decidedByName: record?.decidedByName ? decidedByNameToRead(record.decidedByName) : undefined,
    decidedAt: record?.decidedAt,
  });
}

export interface DecisionDeps {
  repo: ReviewRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
  publishOptions?: PublishOptions;
}

/** caller の決めた表示の有無にかかわらず、応答は本人にだけ undoUntil を返す（呼び出し側は常に本人） */
export function createDecisionRoutes(deps: DecisionDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  async function publishStatusChanged(
    record: ReviewDecisionRecord,
    previousStatus: 'checking',
    actor: string,
    requestId: string,
  ) {
    const changedAt = record.decidedAt ?? now().toISOString();
    const envelope = createEnvelope<ReviewStatusChangedData>({
      type: 'review.status-changed',
      source: 'Review',
      actorAccountId: actor,
      // 知らせの occurredAt は確定の時刻（一覧は新しいものだけを反映する。BR4.1）
      now: () => new Date(changedAt),
      newId,
      data: {
        reportId: record.reportId,
        status: record.status,
        previousStatus,
        ...(record.status === 'rejected' && record.reason ? { reason: record.reason } : {}),
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
      throw errors.internal('確認の結果を記録できませんでした。もう一度お試しください');
    }
    await deps.repo.markEventSent(record.reportId);
  }

  async function handleDecision(
    event: Parameters<RouteHandler>[0],
    status: 'approved' | 'rejected',
    body: Record<string, unknown>,
  ) {
    const caller = getCaller(event);
    requireRole(caller, 'requester');
    const requestId = requestIdOf(event);
    const reportId = event.pathParameters?.reportId;
    if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);

    // BR3.8: 却下には理由が必須（画面でも同じ確認を行う前提で、サーバーでも必ず確かめる）
    const rejection = status === 'rejected' ? validateReject(body) : undefined;

    const current = await deps.repo.get(reportId);
    if (!current) throw reviewNotReady();
    if (current.status === status && current.decidedByAccountId === caller.accountId) {
      // 同じ依頼元の送り直し。知らせがまだなら送り直す
      if (!current.eventSent)
        await publishStatusChanged(current, 'checking', caller.accountId, requestId);
      return json(
        200,
        reviewView(current, {
          includeUndo: canShowUndo(current, caller.accountId, now().getTime()),
        }),
        requestId,
      );
    }
    if (current.status !== 'checking') throw alreadyDecided(current);

    const decidedAt = now().toISOString();
    const undoUntil = new Date(new Date(decidedAt).getTime() + UNDO_WINDOW_MS).toISOString();
    const decidedByName = decidedByNameToWrite(caller.name);
    const decideInput: DecideInput = {
      status,
      decidedByAccountId: caller.accountId,
      decidedByName,
      decidedAt,
      undoUntil,
      reason: rejection?.reason,
      reasonText: rejection?.reasonText,
    };
    if (!(await deps.repo.decide(reportId, decideInput))) {
      // 先にほかの依頼元が確認した（BR3.3・BR3.11）
      throw alreadyDecided(await deps.repo.get(reportId));
    }
    const decided: ReviewDecisionRecord = {
      ...current,
      status,
      decidedByAccountId: caller.accountId,
      decidedByName,
      decidedAt,
      undoUntil,
      reason: rejection?.reason,
      reasonText: rejection?.reasonText,
      lastEventAt: decidedAt,
      eventSent: false,
    };
    await publishStatusChanged(decided, 'checking', caller.accountId, requestId);
    // U4（BR12.5）: 操作の記録。補助的な観測のため、失敗しても主な処理は止めない
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'Review',
      {
        action: status === 'approved' ? 'review.approved' : 'review.rejected',
        targetType: 'report',
        targetId: reportId,
        outcome: 'succeeded',
        actorAccountId: caller.accountId,
        actorName: caller.name,
      },
      {
        actorAccountId: caller.accountId,
        now,
        newId,
        publishOptions: deps.publishOptions,
        onError: (err, eventId) =>
          deps.logger.error('audit.recorded を送れなかった', {
            requestId,
            errorCode: 'EVENT_PUBLISH_FAILED',
            eventId,
          }),
      },
    );
    return json(200, reviewView(decided, { includeUndo: true }), requestId);
  }

  return {
    'PUT /v1/reviews/{reportId}/decision': async (event) => {
      const body = parseJsonBody(event);
      if (body.decision === 'approved') return handleDecision(event, 'approved', body);
      if (body.decision === 'rejected') return handleDecision(event, 'rejected', body);
      throw errors.validation([{ field: 'decision', reason: 'unsupported' }]);
    },
  };
}
