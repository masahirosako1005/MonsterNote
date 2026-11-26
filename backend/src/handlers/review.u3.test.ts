// U3: review 関数の入口に却下・取り消しの道が足されていることの試験
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { apiEvent, requesterClaims } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const lambdaMock = mockClient(LambdaClient);

const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  REVIEW_DECISIONS_TABLE: 'ReviewDecisions',
  EVENT_BUS_NAME: 'monsternote-dev',
  // U4: すべて削除・mustChangePasswordゲートを足したことに伴う追加の環境変数
  ACCOUNTS_FUNCTION_NAME: 'accounts-function',
};

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  lambdaMock.reset();
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
  lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: false }) });
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('review 関数の入口', () => {
  it('PUT decision=rejected の道を持つ', async () => {
    const { handler } = await import('./review');
    ddbMock.on(GetCommand).resolves({
      Item: {
        reportId: 'report-1',
        hunterAccountId: 'hunter-a',
        status: 'checking',
        submittedAt: '2026-11-23T03:00:00.000Z',
        lastEventAt: '2026-11-23T03:00:00.000Z',
        eventSent: true,
      },
    });
    ddbMock.on(UpdateCommand).resolves({});
    const res = await handler(
      apiEvent({
        routeKey: 'PUT /v1/reviews/{reportId}/decision',
        claims: requesterClaims(),
        body: { decision: 'rejected', reason: 'duplicate' },
        pathParameters: { reportId: 'report-1' },
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('POST decision/undo の道を持つ', async () => {
    const { handler } = await import('./review');
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await handler(
      apiEvent({
        routeKey: 'POST /v1/reviews/{reportId}/decision/undo',
        claims: requesterClaims(),
        pathParameters: { reportId: 'report-1' },
      }),
    );
    expect(res.statusCode).toBe(404);
  });
});
