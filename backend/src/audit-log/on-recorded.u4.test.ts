// audit.recorded の受け手の試験（BR12.2〜BR12.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createOnRecorded } from './on-recorded';
import { createAuditLogRepository } from './repository';
import { createLogger } from '../shared/logger';
import { busEvent } from '../../test/helpers/events';
import type { AuditRecordedData, EventEnvelope } from '../shared/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createAuditLogRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'AuditEntries',
);
const now = () => new Date('2026-11-25T00:00:01.000Z');

const envelope: EventEnvelope<AuditRecordedData> = {
  eventId: 'event-1',
  type: 'audit.recorded',
  version: 1,
  occurredAt: '2026-11-25T00:00:00.000Z',
  source: 'Review',
  actorAccountId: 'req-1',
  data: {
    action: 'review.approved',
    targetType: 'report',
    targetId: 'report-1',
    outcome: 'succeeded',
    actorName: '市の担当',
  },
};

beforeEach(() => ddbMock.reset());

describe('createOnRecorded', () => {
  it('entryId=eventIdで記録を作る（二重登録を防ぐため。BR12.2）', async () => {
    ddbMock.on(PutCommand).resolves({});
    const logLines: string[] = [];
    const onRecorded = createOnRecorded({
      repo,
      logger: createLogger('audit-log', (l) => logLines.push(l)),
      now,
    });
    await onRecorded(busEvent('audit.recorded', envelope));
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call?.args[0].input.Item).toMatchObject({
      entryId: 'event-1',
      eventId: 'event-1',
      action: 'review.approved',
      recordedAt: '2026-11-25T00:00:01.000Z',
    });
  });

  it('同じeventIdを2回受けても2件目は何もしない', async () => {
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const onRecorded = createOnRecorded({
      repo,
      logger: createLogger('audit-log', () => undefined),
      now,
    });
    await expect(onRecorded(busEvent('audit.recorded', envelope))).resolves.toBeUndefined();
  });

  it('形が正しくなければ例外を投げる（EventBridgeのやり直しに任せる）', async () => {
    const onRecorded = createOnRecorded({
      repo,
      logger: createLogger('audit-log', () => undefined),
      now,
    });
    await expect(
      onRecorded(busEvent('audit.recorded', { ...envelope, data: {} as AuditRecordedData })),
    ).rejects.toThrow();
  });
});
