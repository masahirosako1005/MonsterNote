// publishAuditRecorded の試験（U4・BR12.5・NFR5.16）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { publishAuditRecorded } from './events';

const eb = mockClient(EventBridgeClient);
const client = new EventBridgeClient({ region: 'ap-northeast-1' });
const now = () => new Date('2026-11-25T00:00:00.000Z');

beforeEach(() => eb.reset());

describe('publishAuditRecorded', () => {
  it('audit.recordedの知らせを送る', async () => {
    eb.on(PutEventsCommand).resolves({ FailedEntryCount: 0, Entries: [{ EventId: 'x' }] });
    await publishAuditRecorded(
      client,
      'bus',
      'Review',
      { action: 'review.approved', targetType: 'report', targetId: 'r-1', outcome: 'succeeded' },
      { actorAccountId: 'req-1', now },
    );
    const call = eb.commandCalls(PutEventsCommand)[0];
    const entry = call?.args[0].input.Entries?.[0];
    expect(entry?.DetailType).toBe('audit.recorded');
    const detail = JSON.parse(entry?.Detail ?? '{}');
    expect(detail.data).toEqual({
      action: 'review.approved',
      targetType: 'report',
      targetId: 'r-1',
      outcome: 'succeeded',
    });
  });

  it('送信に失敗しても例外を投げない（補助的な観測。fire-and-log）', async () => {
    eb.on(PutEventsCommand).rejects(new Error('boom'));
    let errorSeen = false;
    await publishAuditRecorded(
      client,
      'bus',
      'Review',
      { action: 'review.approved', targetType: 'report', outcome: 'succeeded' },
      { now, publishOptions: { delaysMs: [] }, onError: () => (errorSeen = true) },
    );
    expect(errorSeen).toBe(true);
  });
});
