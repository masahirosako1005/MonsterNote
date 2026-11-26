// PUT /v1/me/consent の試験（BR11.5）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createConsentRoute } from './consent';
import { createAccountsRepository } from './repository';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const accounts = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);
const now = () => new Date('2026-11-25T00:00:00.000Z');

beforeEach(() => ddbMock.reset());

describe('createConsentRoute', () => {
  it('同意すると consentedAt が入る（AC1.3.1）', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const route = createConsentRoute({ accounts, now });
    const res = await route(
      apiEvent({ routeKey: 'PUT /v1/me/consent', body: { consented: true } }),
    );
    expect(res.statusCode).toBe(204);
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeNames).toEqual({
      '#k0': 'consentedAt',
    });
  });

  it('同意しないと consentDeclinedAt が入る（AC1.3.2）', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const route = createConsentRoute({ accounts, now });
    await route(apiEvent({ routeKey: 'PUT /v1/me/consent', body: { consented: false } }));
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeNames).toEqual({
      '#k0': 'consentDeclinedAt',
    });
  });

  it('consented が無ければ検証エラー', async () => {
    const route = createConsentRoute({ accounts, now });
    await expect(route(apiEvent({ routeKey: 'PUT /v1/me/consent', body: {} }))).rejects.toThrow();
  });
});
