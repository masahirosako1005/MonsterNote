// U3: 却下・取り消しの条件付き書き換え（reliability-design.md §1）。
// 却下の成功・409 ALREADY_DECIDED、取り消しの成功・403・409 UNDO_EXPIRED・409 ALREADY_UNDONE の各パターン。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createDecisionRoutes } from './decision';
import { createUndoRoutes } from './undo';
import { createReviewRepository } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients, fixedNow, sequenceIds } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const c = clients();
const repo = createReviewRepository(c.ddb, 'ReviewDecisions');
const handler = createHttpHandler(
  {
    ...createDecisionRoutes({
      repo,
      eventBridge: c.eventBridge,
      busName: 'monsternote-dev',
      logger: createLogger('review', () => undefined),
      now: fixedNow('2026-11-23T04:00:00.000Z'),
      newId: sequenceIds('event-1', 'event-2'),
      publishOptions: { sleep: async () => undefined },
    }),
    ...createUndoRoutes({
      repo,
      eventBridge: c.eventBridge,
      busName: 'monsternote-dev',
      logger: createLogger('review', () => undefined),
      now: fixedNow('2026-11-23T04:00:05.000Z'),
      newId: sequenceIds('event-undo-1'),
    }),
  },
  createLogger('review', () => undefined),
);

const checking = {
  reportId: 'report-1',
  hunterAccountId: 'hunter-a',
  status: 'checking',
  submittedAt: '2026-11-23T03:00:00.000Z',
  lastEventAt: '2026-11-23T03:00:01.000Z',
  eventSent: true,
};
const decidedBy = (
  status: 'approved' | 'rejected',
  sub: string,
  undoUntil = '2026-11-23T04:00:10.000Z',
) => ({
  ...checking,
  status,
  decidedByAccountId: sub,
  decidedByName: `表示名-${sub}`,
  decidedAt: '2026-11-23T04:00:00.000Z',
  undoUntil,
  ...(status === 'rejected' ? { reason: 'other', reasonText: '写真が不鮮明' } : {}),
  eventSent: true,
});

const bodyOf = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;
const decide = (body: unknown, claims = requesterClaims()) =>
  handler(
    apiEvent({
      routeKey: 'PUT /v1/reviews/{reportId}/decision',
      claims,
      body,
      pathParameters: { reportId: 'report-1' },
    }),
  );
const undo = (claims = requesterClaims()) =>
  handler(
    apiEvent({
      routeKey: 'POST /v1/reviews/{reportId}/decision/undo',
      claims,
      pathParameters: { reportId: 'report-1' },
    }),
  );

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
});

describe('却下（PUT decision=rejected）', () => {
  it('理由が揃っていれば受け付け、undoUntil = decidedAt + 10 秒で却下する', async () => {
    ddbMock.on(GetCommand).resolves({ Item: checking });
    ddbMock.on(UpdateCommand).resolves({});
    const res = await decide({ decision: 'rejected', reason: 'duplicate' });
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toMatchObject({
      status: 'rejected',
      reason: 'duplicate',
      undoUntil: '2026-11-23T04:00:10.000Z',
    });
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.ConditionExpression).toBe('#status = :checking');
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':status': 'rejected' });
  });

  it('other のときは reasonText も返す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: checking });
    ddbMock.on(UpdateCommand).resolves({});
    const res = await decide({ decision: 'rejected', reason: 'other', reasonText: '写真が不鮮明' });
    expect(bodyOf(res)).toMatchObject({ reason: 'other', reasonText: '写真が不鮮明' });
  });

  it('理由が知らない値なら 422', async () => {
    ddbMock.on(GetCommand).resolves({ Item: checking });
    const res = await decide({ decision: 'rejected', reason: 'because' });
    expect(res.statusCode).toBe(422);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('すでにほかの依頼元が確認していれば 409 ALREADY_DECIDED', async () => {
    ddbMock.on(GetCommand).resolves({ Item: decidedBy('approved', 'requester-b') });
    const res = await decide({ decision: 'rejected', reason: 'duplicate' });
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res)).toMatchObject({
      code: 'ALREADY_DECIDED',
      conflict: { decision: 'approved', decidedByName: '表示名-requester-b' },
    });
  });

  it('同時に 2 人が却下しても、条件付き書き換えは 1 回しか成功しない（US4.6）', async () => {
    ddbMock
      .on(GetCommand)
      .resolvesOnce({ Item: checking })
      .resolves({ Item: decidedBy('rejected', 'requester-b') });
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const res = await decide({ decision: 'rejected', reason: 'duplicate' });
    expect(res.statusCode).toBe(409);
  });

  it('ハンターは却下できない（403）', async () => {
    const res = await decide({ decision: 'rejected', reason: 'duplicate' }, hunterClaims());
    expect(res.statusCode).toBe(403);
  });
});

describe('取り消し（POST decision/undo）', () => {
  it('本人が期限内なら確認中に戻し、review.status-changed（undone）とaudit.recordedを1回ずつ試す', async () => {
    const previous = decidedBy('rejected', 'requester-a');
    ddbMock.on(UpdateCommand).resolves({ Attributes: previous });
    const res = await undo(requesterClaims());
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toEqual({ reportId: 'report-1', status: 'checking' });
    // U4: review.status-changed（undone）とaudit.recordedの2件を、どちらも結果を待たず1回だけ試す
    await vi.waitFor(() => expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(2));
    const envelope = JSON.parse(
      ebMock.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0]?.Detail ?? '{}',
    );
    expect(envelope).toMatchObject({
      type: 'review.status-changed',
      data: { reportId: 'report-1', status: 'checking', previousStatus: 'rejected' },
    });
    const auditEnvelope = JSON.parse(
      ebMock.commandCalls(PutEventsCommand)[1]?.args[0].input.Entries?.[0]?.Detail ?? '{}',
    );
    expect(auditEnvelope).toMatchObject({
      type: 'audit.recorded',
      data: { action: 'review.undone', targetType: 'report', targetId: 'report-1' },
    });
  });

  it('本人以外は 403（本人ではない）', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: decidedBy('approved', 'requester-a') });
    const res = await undo(requesterClaims('requester-b'));
    expect(res.statusCode).toBe(403);
  });

  it('期限切れは 409 UNDO_EXPIRED', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: decidedBy('approved', 'requester-a') });
    const res = await undo(requesterClaims('requester-a'));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).code).toBe('UNDO_EXPIRED');
  });

  it('本人の二重送信は 409 ALREADY_UNDONE（「本人ではない」にはならない。D-6）', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: checking });
    const res = await undo(requesterClaims('requester-a'));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).code).toBe('ALREADY_UNDONE');
  });

  it('記録がなければ 404 REVIEW_NOT_READY', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await undo(requesterClaims());
    expect(res.statusCode).toBe(404);
  });

  it('ハンターは取り消せない（403。承認・却下と同じく依頼元だけ）', async () => {
    const res = await undo(hunterClaims());
    expect(res.statusCode).toBe(403);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});
