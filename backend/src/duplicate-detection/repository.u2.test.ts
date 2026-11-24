// ReportFootprints・DuplicateSuspicions の表への読み書きの試験（entities.md）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  BY_REPORT_INDEX,
  createDuplicateRepository,
  SPECIES_DAY_INDEX,
  type DuplicateSuspicionRecord,
  type ReportFootprintRecord,
} from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const tables = { footprints: 'ReportFootprints', suspicions: 'DuplicateSuspicions' };
const repo = createDuplicateRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  tables,
);

const footprint: ReportFootprintRecord = {
  reportId: 'report-1',
  savedReceived: true,
  species: 'boar',
  location: { lat: 35, lng: 135 },
  capturedAt: '2026-11-20T03:00:00.000Z',
  speciesDay: 'boar#2026-11-20',
  active: true,
  hunterAccountId: 'hunter-a',
  addedAt: '2026-11-20T03:00:00.000Z',
  lastSavedEventAt: '2026-11-20T03:00:00.000Z',
};

const suspicion: DuplicateSuspicionRecord = {
  suspicionId: 'report-1#report-2#place-time',
  reportId: 'report-1',
  matchedReportId: 'report-2',
  kind: 'place-time',
  distanceMeters: 100,
  hoursApart: 2,
  phase: 'post-save',
  detectedAt: '2026-11-20T03:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('createDuplicateRepository', () => {
  it('ReportFootprint を作る・読む', async () => {
    ddbMock.on(PutCommand).resolves({});
    await repo.putFootprint(footprint);
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
      TableName: 'ReportFootprints',
      Item: footprint,
    });

    ddbMock.on(GetCommand).resolves({ Item: footprint });
    await expect(repo.getFootprint('report-1')).resolves.toEqual(footprint);
  });

  it('索引がまだなければ undefined', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(repo.getFootprint('report-x')).resolves.toBeUndefined();
  });

  it('speciesDay の索引で 1 ページ分を読む（limit を渡す）', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [footprint] });
    await expect(repo.queryBySpeciesDay('boar#2026-11-20', 100)).resolves.toEqual([footprint]);
    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.IndexName).toBe(SPECIES_DAY_INDEX);
    expect(call?.ExpressionAttributeValues).toEqual({ ':speciesDay': 'boar#2026-11-20' });
    expect(call?.Limit).toBe(100);
  });

  it('DuplicateSuspicion を条件付きで作る。すでにあれば false（BR8.6）', async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(repo.putSuspicionIfAbsent(suspicion)).resolves.toBe(true);
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input.ConditionExpression).toBe(
      'attribute_not_exists(suspicionId)',
    );

    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    await expect(repo.putSuspicionIfAbsent(suspicion)).resolves.toBe(false);
  });

  it('報告 1 件の疑いの一覧を読む', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [suspicion] });
    await expect(repo.listSuspicionsByReport('report-1')).resolves.toEqual([suspicion]);
    expect(ddbMock.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      TableName: 'DuplicateSuspicions',
      IndexName: BY_REPORT_INDEX,
      ExpressionAttributeValues: { ':reportId': 'report-1' },
    });
  });
});
