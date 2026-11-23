// report.saved で確認中の記録を作る試験（BR3.1、AC4.3.1、NFR10.4: 2 回目の eventId は無視）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { createReviewOnSaved } from './on-saved';
import { createReviewRepository } from './repository';
import { createProcessedEvents } from '../shared/processed-events';
import { createLogger } from '../shared/logger';
import { busEvent } from '../../test/helpers/events';
import { clients, fixedNow } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const onSaved = createReviewOnSaved({
  repo: createReviewRepository(c.ddb, 'ReviewDecisions'),
  processed: createProcessedEvents(c.ddb, 'ProcessedEvents', 'review-on-saved', fixedNow()),
  logger: createLogger('review-on-saved', () => undefined),
});

const envelope = {
  eventId: 'event-1',
  type: 'report.saved',
  version: 1,
  occurredAt: '2026-11-23T03:00:01.000Z',
  source: 'Reporting',
  data: {
    reportId: 'report-1',
    hunterAccountId: 'hunter-a',
    hunterName: 'ハンター A',
    species: 'boar',
    capturedAt: '2026-11-23T03:00:00.000Z',
    location: { lat: 35, lng: 135 },
    manualEntry: false,
    submittedAt: '2026-11-23T03:00:00.000Z',
    bodyPhotoId: 'photo-1',
  },
};

beforeEach(() => ddbMock.reset());

describe('review-on-saved', () => {
  it('確認中の記録を、知らせのハンターの ID を写して作り、eventId を処理済みにする', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});
    await onSaved(busEvent('report.saved', envelope));
    const puts = ddbMock.commandCalls(PutCommand).map((call) => call.args[0].input);
    expect(puts[0]).toMatchObject({
      TableName: 'ReviewDecisions',
      Item: {
        reportId: 'report-1',
        hunterAccountId: 'hunter-a',
        status: 'checking',
        submittedAt: '2026-11-23T03:00:00.000Z',
        lastEventAt: '2026-11-23T03:00:01.000Z',
        eventSent: true,
      },
      ConditionExpression: 'attribute_not_exists(reportId)',
    });
    // 処理済みの記録は 7 日で TTL により消える
    expect(puts[1]).toMatchObject({
      TableName: 'ProcessedEvents',
      Item: { consumerEventId: 'review-on-saved#event-1', expiresAt: 1796007600 },
    });
  });

  it('同じ eventId の 2 回目は何もしない', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { consumerEventId: 'review-on-saved#event-1' } });
    await onSaved(busEvent('report.saved', envelope));
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('記録がすでにある（別の eventId の再送）なら、書き換えずに処理済みにする', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock
      .on(PutCommand, { TableName: 'ReviewDecisions' })
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(PutCommand, { TableName: 'ProcessedEvents' }).resolves({});
    await expect(onSaved(busEvent('report.saved', envelope))).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(PutCommand, { TableName: 'ProcessedEvents' })).toHaveLength(1);
  });

  it('表の書き込みに失敗したら例外を投げ、処理済みにしない（EventBridge がやり直す）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand, { TableName: 'ReviewDecisions' }).rejects(new Error('throttled'));
    await expect(onSaved(busEvent('report.saved', envelope))).rejects.toThrow('throttled');
    expect(ddbMock.commandCalls(PutCommand, { TableName: 'ProcessedEvents' })).toHaveLength(0);
  });

  it('形の壊れた知らせ（reportId がない）は例外にする', async () => {
    await expect(
      onSaved(busEvent('report.saved', { ...envelope, data: { ...envelope.data, reportId: '' } })),
    ).rejects.toThrow();
  });
});
