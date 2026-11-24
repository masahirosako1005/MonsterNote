// 判別の呼び出し回数の上限の試験（NFR12.5。行がない最初の呼び出し・30 件目・31 件目）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createDetectionRateLimiter, DAILY_DETECTION_LIMIT, jstDateKeyOf } from './rate-limit';

const ddbMock = mockClient(DynamoDBDocumentClient);
const raw = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const fixedNow = () => new Date('2026-11-23T03:00:00.000Z');

beforeEach(() => ddbMock.reset());

describe('jstDateKeyOf', () => {
  it('UTC の時刻を日本時間（UTC+9）の日付に変える', () => {
    expect(jstDateKeyOf(new Date('2026-11-23T03:00:00.000Z'))).toBe('2026-11-23');
    // UTC 15:30 は JST では翌日の 0:30
    expect(jstDateKeyOf(new Date('2026-11-23T15:30:00.000Z'))).toBe('2026-11-24');
  });
});

describe('createDetectionRateLimiter', () => {
  it('行がない最初の呼び出しはアトミックに行を作り、true を返す', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const limiter = createDetectionRateLimiter(raw, 'DetectionRateLimits', fixedNow);
    await expect(limiter.tryConsume('hunter-a')).resolves.toBe(true);
    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.Key).toEqual({ accountIdDate: 'hunter-a#2026-11-23' });
    expect(call?.UpdateExpression).toContain('if_not_exists(callCount, :zero) + :one');
    expect(call?.ConditionExpression).toBe('callCount < :limit OR attribute_not_exists(callCount)');
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':limit': DAILY_DETECTION_LIMIT });
  });

  it('30 件目（上限未満からの増加）は true', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const limiter = createDetectionRateLimiter(raw, 'DetectionRateLimits', fixedNow);
    await expect(limiter.tryConsume('hunter-a')).resolves.toBe(true);
  });

  it('31 件目（条件に合わない）は false を返し、判別を呼ばせない', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const limiter = createDetectionRateLimiter(raw, 'DetectionRateLimits', fixedNow);
    await expect(limiter.tryConsume('hunter-a')).resolves.toBe(false);
  });

  it('条件の失敗以外の例外はそのまま投げる', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('boom'));
    const limiter = createDetectionRateLimiter(raw, 'DetectionRateLimits', fixedNow);
    await expect(limiter.tryConsume('hunter-a')).rejects.toThrow('boom');
  });
});
