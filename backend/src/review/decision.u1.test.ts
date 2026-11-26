// 承認と状態の読み取りの試験（BR3.2〜BR3.7、AC4.3.1・AC4.3.2・AC4.3.3、reliability-design の承認の知らせ）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createDecisionRoutes } from './decision';
import { createGetReviewRoutes } from './get-review';
import { createReviewRepository } from './repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients, fixedNow, sequenceIds } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const c = clients();
const repo = createReviewRepository(c.ddb, 'ReviewDecisions');
const logLines: string[] = [];
const handler = createHttpHandler(
  {
    ...createDecisionRoutes({
      repo,
      eventBridge: c.eventBridge,
      busName: 'monsternote-dev',
      logger: createLogger('review', (l) => logLines.push(l)),
      now: fixedNow('2026-11-23T04:00:00.000Z'),
      newId: sequenceIds('event-1', 'event-2'),
      publishOptions: { sleep: async () => undefined },
    }),
    ...createGetReviewRoutes({ repo }),
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
const approvedBy = (sub: string, eventSent = true) => ({
  ...checking,
  status: 'approved',
  decidedByAccountId: sub,
  decidedByName: `表示名-${sub}`,
  decidedAt: '2026-11-23T03:30:00.000Z',
  eventSent,
});

const decide = (
  claims: Record<string, string> = requesterClaims(),
  body: unknown = { decision: 'approved' },
) =>
  handler(
    apiEvent({
      routeKey: 'PUT /v1/reviews/{reportId}/decision',
      claims,
      body,
      pathParameters: { reportId: 'report-1' },
    }),
  );
const bodyOf = (res: { body?: string }) => JSON.parse(res.body ?? '{}') as Record<string, unknown>;

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  logLines.length = 0;
});

describe('PUT /v1/reviews/{reportId}/decision', () => {
  it('確認中なら条件付きで承認にし、確認した人と日時を記録して review.status-changed を送る', async () => {
    ddbMock.on(GetCommand).resolves({ Item: checking });
    ddbMock.on(UpdateCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const res = await decide();
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toEqual({
      reportId: 'report-1',
      status: 'approved',
      decidedByName: '表示名-requester-a',
      decidedAt: '2026-11-23T04:00:00.000Z',
      // U3 で undoUntil が本番になった（BR3.9）
      undoUntil: '2026-11-23T04:00:10.000Z',
    });
    const update = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(update?.ConditionExpression).toBe('#status = :checking');
    expect(update?.ExpressionAttributeValues).toMatchObject({
      ':by': 'requester-a',
      ':false': false,
    });
    const envelope = JSON.parse(
      ebMock.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0]?.Detail ?? '{}',
    );
    expect(envelope).toMatchObject({
      type: 'review.status-changed',
      source: 'Review',
      occurredAt: '2026-11-23T04:00:00.000Z',
      data: { reportId: 'report-1', status: 'approved', previousStatus: 'checking' },
    });
    // 送れたら eventSent を「済み」にする
    expect(ddbMock.commandCalls(UpdateCommand)[1]?.args[0].input.UpdateExpression).toBe(
      'SET eventSent = :true',
    );
  });

  it('ハンターは承認できない（403）', async () => {
    const res = await decide(hunterClaims());
    expect(res.statusCode).toBe(403);
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(0);
  });

  it('確認の記録がまだなければ 404 REVIEW_NOT_READY', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await decide();
    expect(res.statusCode).toBe(404);
    expect(bodyOf(res)).toEqual({
      code: 'REVIEW_NOT_READY',
      message: 'まだ確認の準備ができていません。少し待ってからもう一度押してください',
    });
  });

  it('ほかの依頼元がすでに承認していれば 409 ALREADY_DECIDED と確認した人を返す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: approvedBy('requester-b') });
    const res = await decide();
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res)).toMatchObject({
      code: 'ALREADY_DECIDED',
      conflict: {
        decision: 'approved',
        decidedByName: '表示名-requester-b',
        decidedAt: '2026-11-23T03:30:00.000Z',
      },
    });
  });

  it('同時の承認で条件に合わなかったら、読み直して 409', async () => {
    ddbMock
      .on(GetCommand)
      .resolvesOnce({ Item: checking })
      .resolves({ Item: approvedBy('requester-b') });
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const res = await decide();
    expect(res.statusCode).toBe(409);
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(0);
  });

  it('同じ依頼元の送り直しは 200。知らせが「まだ」なら送り直す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: approvedBy('requester-a', true) });
    const done = await decide();
    expect(done.statusCode).toBe(200);
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(0);

    ddbMock.on(GetCommand).resolves({ Item: approvedBy('requester-a', false) });
    ddbMock.on(UpdateCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    const resent = await decide();
    expect(resent.statusCode).toBe(200);
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(1);
  });

  it('知らせを 3 回とも送れなければ 500 で、EVENT_PUBLISH_FAILED をログに出す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: checking });
    ddbMock.on(UpdateCommand).resolves({});
    ebMock.on(PutEventsCommand).rejects(new Error('down'));
    const res = await decide();
    expect(res.statusCode).toBe(500);
    expect(logLines.some((l) => l.includes('EVENT_PUBLISH_FAILED'))).toBe(true);
  });

  it('decision が approved・rejected 以外なら 400', async () => {
    const res = await decide(requesterClaims(), { decision: 'pending' });
    expect(res.statusCode).toBe(400);
  });

  // U3 で却下（rejected）も受け付けるようになった（BR3.8）。理由の確認は validate-reject.u3.test.ts・
  // decision.u3.test.ts でまとめて試す
  it('U3: rejected は理由が必須（理由がなければ 422）', async () => {
    const res = await decide(requesterClaims(), { decision: 'rejected' });
    expect(res.statusCode).toBe(422);
  });
});

describe('GET /v1/reviews/{reportId}', () => {
  const read = (claims: Record<string, string>) =>
    handler(
      apiEvent({
        routeKey: 'GET /v1/reviews/{reportId}',
        claims,
        pathParameters: { reportId: 'report-1' },
      }),
    );

  it('依頼元は状態と確認した人を読める', async () => {
    ddbMock.on(GetCommand).resolves({ Item: approvedBy('requester-b') });
    const res = await read(requesterClaims());
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toEqual({
      reportId: 'report-1',
      status: 'approved',
      decidedByName: '表示名-requester-b',
      decidedAt: '2026-11-23T03:30:00.000Z',
    });
  });

  it('ハンターは自分の報告の状態だけを読める（他人は 403）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: checking });
    expect((await read(hunterClaims('hunter-a'))).statusCode).toBe(200);
    expect((await read(hunterClaims('hunter-b'))).statusCode).toBe(403);
  });

  it('記録がなければ 404 REVIEW_NOT_READY', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await read(requesterClaims());
    expect(res.statusCode).toBe(404);
    expect(bodyOf(res).code).toBe('REVIEW_NOT_READY');
  });
});
