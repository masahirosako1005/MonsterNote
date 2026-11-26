// duplicate-detection-on-saved・duplicate-detection-on-status の関数の入口の試験
// （環境変数から部品を組み立て、EventBridge の知らせを正しい処理に渡す）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { busEvent } from '../../test/helpers/events';

const ddbMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  REPORT_FOOTPRINTS_TABLE: 'ReportFootprints',
  DUPLICATE_SUSPICIONS_TABLE: 'DuplicateSuspicions',
  PROCESSED_EVENTS_TABLE: 'ProcessedEvents',
  EVENT_BUS_NAME: 'monsternote-dev',
  SETTINGS_FUNCTION_NAME: 'settings-fn',
};

const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

beforeEach(() => {
  ddbMock.reset();
  lambdaMock.reset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('duplicate-detection-on-saved の関数の入口', () => {
  it('report.saved を受けて索引に書く（部品の身元の証明で Settings を読む）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    lambdaMock.on(InvokeCommand).resolves({
      Payload: payload({
        settingKey: 'default',
        duplicateDistanceMeters: 1000,
        duplicateWindowHours: 24,
        targetAreaNorth: 46,
        targetAreaSouth: 20,
        targetAreaEast: 154,
        targetAreaWest: 122,
        updatedAt: '2026-11-01T00:00:00.000Z',
      }),
    });
    const { handler } = await import('./duplicate-detection-on-saved');
    await handler(
      busEvent('report.saved', {
        eventId: 'e1',
        type: 'report.saved',
        version: 1,
        occurredAt: '2026-11-20T04:00:00.000Z',
        source: 'Reporting',
        data: {
          reportId: 'r1',
          hunterAccountId: 'h',
          hunterName: 'n',
          species: 'deer',
          capturedAt: '2026-11-20T04:00:00.000Z',
          location: { lat: 35, lng: 135 },
          manualEntry: false,
          submittedAt: '2026-11-20T04:00:00.000Z',
          bodyPhotoId: 'p',
        },
      } as never),
    );
    const footprintPut = ddbMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input)
      .find((i) => i.TableName === 'ReportFootprints');
    expect(footprintPut?.Item).toMatchObject({ reportId: 'r1', savedReceived: true });
    expect(lambdaMock.commandCalls(InvokeCommand)[0]?.args[0].input.FunctionName).toBe(
      'settings-fn',
    );
  });
});

describe('duplicate-detection-on-status の関数の入口', () => {
  it('review.status-changed を受けて索引の active を書く', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});
    const { handler } = await import('./duplicate-detection-on-status');
    await handler(
      busEvent('review.status-changed', {
        eventId: 'e2',
        type: 'review.status-changed',
        version: 1,
        occurredAt: '2026-11-20T05:00:00.000Z',
        source: 'Review',
        data: { reportId: 'r1', status: 'rejected', previousStatus: 'checking', changedAt: 'x' },
      } as never),
    );
    const footprintPut = ddbMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input)
      .find((i) => i.TableName === 'ReportFootprints');
    expect(footprintPut?.Item).toMatchObject({ reportId: 'r1', active: false });
  });
});
