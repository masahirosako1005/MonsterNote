// 知らせの共通の処理の試験（contract-summary 2.4、reliability-design: 最大 3 回・間隔 0.1・0.2 秒）
import { describe, expect, it, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createEnvelope, EventPublishError, publishEvent, eventSourceOf } from './events';

const eb = mockClient(EventBridgeClient);
const client = new EventBridgeClient({ region: 'ap-northeast-1' });

function recorder() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
}

describe('createEnvelope', () => {
  it('EventEnvelope の必須の項目（eventId・type・version・occurredAt・source・data）を作る', () => {
    const env = createEnvelope({
      type: 'report.saved',
      source: 'Reporting',
      data: { reportId: 'r-1' },
      actorAccountId: 'hunter-a',
      now: () => new Date('2026-11-23T00:00:00Z'),
      newId: () => '11111111-1111-4111-8111-111111111111',
    });
    expect(env).toEqual({
      eventId: '11111111-1111-4111-8111-111111111111',
      type: 'report.saved',
      version: 1,
      occurredAt: '2026-11-23T00:00:00.000Z',
      actorAccountId: 'hunter-a',
      source: 'Reporting',
      data: { reportId: 'r-1' },
    });
  });

  it('eventId を渡さなければ UUID を作る', () => {
    const env = createEnvelope({ type: 'x', source: 'Review', data: {} });
    expect(env.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.actorAccountId).toBeUndefined();
  });

  it('部品の名前を EventBridge の source に変える', () => {
    expect(eventSourceOf('Reporting')).toBe('monsternote.reporting');
    expect(eventSourceOf('Review')).toBe('monsternote.review');
  });
});

describe('publishEvent', () => {
  beforeEach(() => eb.reset());
  const env = createEnvelope({
    type: 'report.saved',
    source: 'Reporting',
    data: { reportId: 'r-1' },
  });

  it('1 回で送れたら、やり直さない。バス・source・detail-type・中身を渡す', async () => {
    eb.on(PutEventsCommand).resolves({ FailedEntryCount: 0, Entries: [{ EventId: 'e' }] });
    const r = recorder();
    await publishEvent(client, 'monsternote-dev', env, { sleep: r.sleep });
    expect(eb.commandCalls(PutEventsCommand)).toHaveLength(1);
    const entry = eb.commandCalls(PutEventsCommand)[0]?.args[0].input.Entries?.[0];
    expect(entry).toMatchObject({
      EventBusName: 'monsternote-dev',
      Source: 'monsternote.reporting',
      DetailType: 'report.saved',
    });
    expect(JSON.parse(entry?.Detail ?? '{}')).toEqual(env);
    expect(r.waits).toEqual([]);
  });

  it('失敗したら 0.1 秒・0.2 秒の間隔でやり直し、3 回目で送れたら成功', async () => {
    eb.on(PutEventsCommand)
      .rejectsOnce(new Error('throttled'))
      .resolvesOnce({ FailedEntryCount: 1, Entries: [{ ErrorCode: 'InternalFailure' }] })
      .resolves({ FailedEntryCount: 0, Entries: [{ EventId: 'e' }] });
    const r = recorder();
    await publishEvent(client, 'bus', env, { sleep: r.sleep });
    expect(eb.commandCalls(PutEventsCommand)).toHaveLength(3);
    expect(r.waits).toEqual([100, 200]);
  });

  it('3 回とも失敗したら EventPublishError を投げる（4 回目は送らない）', async () => {
    eb.on(PutEventsCommand).rejects(new Error('down'));
    const r = recorder();
    await expect(publishEvent(client, 'bus', env, { sleep: r.sleep })).rejects.toBeInstanceOf(
      EventPublishError,
    );
    expect(eb.commandCalls(PutEventsCommand)).toHaveLength(3);
  });

  it('1 回の呼び出しが時間切れ（0.5 秒）なら失敗として数える', async () => {
    eb.on(PutEventsCommand).callsFake(
      (_input, getClient) =>
        new Promise((resolve) => {
          void getClient;
          setTimeout(() => resolve({ FailedEntryCount: 0 }), 50);
        }),
    );
    const r = recorder();
    await expect(
      publishEvent(client, 'bus', env, { sleep: r.sleep, attemptTimeoutMs: 5 }),
    ).rejects.toBeInstanceOf(EventPublishError);
  });
});
