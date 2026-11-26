// GET /v1/me の試験（BR11.7・C1）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createGetMeRoute } from './get-me';
import { createAccountsRepository, type AccountRecord } from './repository';
import { apiEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const accounts = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);

const hunter: AccountRecord = {
  accountId: 'hunter-a',
  loginId: 'hunter01',
  displayName: 'ハンター A',
  role: 'hunter',
  status: 'active',
  mustChangePassword: true,
  createdAt: '2026-11-25T00:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('createGetMeRoute', () => {
  it('手続きが何も済んでいないハンターの3つの印', async () => {
    ddbMock.on(GetCommand).resolves({ Item: hunter });
    const route = createGetMeRoute({ accounts });
    const res = await route(apiEvent({ routeKey: 'GET /v1/me' }));
    expect(JSON.parse(res.body ?? '')).toMatchObject({
      mustChangePassword: true,
      consentRequired: true,
      hunterNumberRequired: true,
    });
  });

  it('依頼元・管理者は consentRequired・hunterNumberRequired が常に false', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...hunter, role: 'requester' } });
    const route = createGetMeRoute({ accounts });
    const res = await route(apiEvent({ routeKey: 'GET /v1/me' }));
    expect(JSON.parse(res.body ?? '')).toMatchObject({
      consentRequired: false,
      hunterNumberRequired: false,
    });
  });

  it('手続きが済んでいれば印は全部 false', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { ...hunter, mustChangePassword: false, consentedAt: 'x', hunterNumber: '1' },
    });
    const route = createGetMeRoute({ accounts });
    const res = await route(apiEvent({ routeKey: 'GET /v1/me' }));
    expect(JSON.parse(res.body ?? '')).toMatchObject({
      mustChangePassword: false,
      consentRequired: false,
      hunterNumberRequired: false,
    });
  });
});
