// ReviewDecisions の表の読み書き（U3。reason・reasonText・undoUntil を本番にする。reliability-design.md §1）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { createReviewRepository } from './repository';
import { clients } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createReviewRepository(c.ddb, 'ReviewDecisions');

beforeEach(() => ddbMock.reset());

describe('decide（承認・却下）', () => {
  it('承認は reason・reasonText を含めない（reliability-design.md §1）', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const ok = await repo.decide('report-1', {
      status: 'approved',
      decidedByAccountId: 'requester-a',
      decidedByName: '表示名',
      decidedAt: '2026-11-23T04:00:00.000Z',
      undoUntil: '2026-11-23T04:00:10.000Z',
    });
    expect(ok).toBe(true);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.ConditionExpression).toBe('#status = :checking');
    expect(input?.UpdateExpression).not.toContain('reason');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':status': 'approved',
      ':undo': '2026-11-23T04:00:10.000Z',
    });
    expect(input?.ExpressionAttributeValues).not.toHaveProperty(':reason');
  });

  it('却下は reason を含め、reasonText があれば一緒に書く', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await repo.decide('report-1', {
      status: 'rejected',
      decidedByAccountId: 'requester-a',
      decidedByName: '表示名',
      decidedAt: '2026-11-23T04:00:00.000Z',
      undoUntil: '2026-11-23T04:00:10.000Z',
      reason: 'other',
      reasonText: '写真が不鮮明',
    });
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.UpdateExpression).toContain('#reason = :reason');
    expect(input?.UpdateExpression).toContain('reasonText = :reasonText');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':reason': 'other',
      ':reasonText': '写真が不鮮明',
    });
  });

  it('確認中でなければ条件に合わず false', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const ok = await repo.decide('report-1', {
      status: 'approved',
      decidedByAccountId: 'requester-a',
      decidedByName: '表示名',
      decidedAt: '2026-11-23T04:00:00.000Z',
      undoUntil: '2026-11-23T04:00:10.000Z',
    });
    expect(ok).toBe(false);
  });
});

describe('undo（取り消し）', () => {
  it('reliability-design.md §1 のとおりの ConditionExpression で、確認中に戻し記録を消す', async () => {
    const previous = {
      reportId: 'report-1',
      hunterAccountId: 'hunter-a',
      status: 'approved',
      decidedByAccountId: 'requester-a',
      decidedByName: '表示名',
      decidedAt: '2026-11-23T04:00:00.000Z',
      undoUntil: '2026-11-23T04:00:10.000Z',
      submittedAt: '2026-11-23T03:00:00.000Z',
      lastEventAt: '2026-11-23T04:00:00.000Z',
      eventSent: true,
    };
    ddbMock.on(UpdateCommand).resolves({ Attributes: previous });
    const result = await repo.undo('report-1', 'requester-a', '2026-11-23T04:00:05.000Z');
    expect(result).toEqual(previous);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.ConditionExpression).toBe(
      '#status <> :checking AND decidedByAccountId = :acct AND undoUntil >= :now',
    );
    expect(input?.UpdateExpression).toContain('REMOVE #reason, reasonText');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':acct': 'requester-a',
      ':now': '2026-11-23T04:00:05.000Z',
    });
    expect(input?.ReturnValues).toBe('ALL_OLD');
  });

  it('条件に合わなければ false（呼んだ側が読み直して理由を判定する）', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const result = await repo.undo('report-1', 'requester-a', '2026-11-23T04:00:20.000Z');
    expect(result).toBe(false);
  });
});
