// PUT /v1/me/hunter-number の試験（BR11.6）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHunterNumberRoute, isValidHunterNumber } from './hunter-number';
import { createAccountsRepository } from './repository';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const accounts = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);

beforeEach(() => ddbMock.reset());

describe('isValidHunterNumber', () => {
  it('数字1〜20桁を受け付ける', () => {
    expect(isValidHunterNumber('1')).toBe(true);
    expect(isValidHunterNumber('12345678901234567890')).toBe(true);
    expect(isValidHunterNumber('123456789012345678901')).toBe(false); // 21桁
    expect(isValidHunterNumber('')).toBe(false);
    expect(isValidHunterNumber('abc')).toBe(false);
  });
});

describe('createHunterNumberRoute', () => {
  it('正しい番号なら登録する（AC1.4.1）', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const route = createHunterNumberRoute({ accounts });
    const res = await route(
      apiEvent({ routeKey: 'PUT /v1/me/hunter-number', body: { hunterNumber: '123' } }),
    );
    expect(res.statusCode).toBe(204);
  });

  it('空では登録できない（AC1.4.2）', async () => {
    const route = createHunterNumberRoute({ accounts });
    await expect(
      route(apiEvent({ routeKey: 'PUT /v1/me/hunter-number', body: { hunterNumber: '' } })),
    ).rejects.toThrow(expect.objectContaining({ status: 400 }));
  });
});
