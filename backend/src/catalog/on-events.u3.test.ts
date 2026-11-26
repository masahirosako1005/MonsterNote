// duplicate.suspected の受け手の試験（BR4.6・UC19。送り手は U2 の DuplicateDetection。C14 の形で試す）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createCatalogOnDuplicate } from './on-duplicate';
import { createCatalogRepository } from './repository';
import { createProcessedEvents } from '../shared/processed-events';
import { createLogger } from '../shared/logger';
import { busEvent } from '../../test/helpers/events';
import { clients, fixedNow } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createCatalogRepository(c.ddb, 'ReportListItems');
const logger = createLogger('catalog-on-duplicate', () => undefined);
const onDuplicate = createCatalogOnDuplicate({
  repo,
  processed: createProcessedEvents(c.ddb, 'ProcessedEvents', 'catalog-on-duplicate', fixedNow()),
  logger,
});

const suspected = {
  eventId: 'event-dup-1',
  type: 'duplicate.suspected',
  version: 1,
  occurredAt: '2026-11-23T05:00:00.000Z',
  source: 'DuplicateDetection',
  data: { reportId: 'report-1', matchedReportId: 'report-9', kind: 'photo' as const },
};

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
});

describe('catalog-on-duplicate', () => {
  it('duplicateSuspected=true と lastDuplicateEventAt を立てる', async () => {
    await onDuplicate(busEvent('duplicate.suspected', suspected));
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.Key).toEqual({ reportId: 'report-1' });
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':true': true,
      ':occurredAt': '2026-11-23T05:00:00.000Z',
    });
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item?.consumerEventId).toBe(
      'catalog-on-duplicate#event-dup-1',
    );
  });

  it('行がまだなければ先に作る（savedReceived=false のまま。一覧にはまだ出ない）', async () => {
    await onDuplicate(busEvent('duplicate.suspected', suspected));
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.UpdateExpression).toContain(
      'savedReceived = if_not_exists(savedReceived, :false)',
    );
  });

  it('同じ eventId の 2 回目は無視する', async () => {
    ddbMock
      .on(GetCommand)
      .resolves({ Item: { consumerEventId: 'catalog-on-duplicate#event-dup-1' } });
    await onDuplicate(busEvent('duplicate.suspected', suspected));
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('形の壊れた知らせは例外にする', async () => {
    await expect(
      onDuplicate(busEvent('duplicate.suspected', { ...suspected, data: {} })),
    ).rejects.toThrow();
  });

  it('相手の報告 ID ごとに別々の知らせとして届く（reviewの R-06。それぞれこの関数で印を立てる）', async () => {
    await onDuplicate(busEvent('duplicate.suspected', suspected));
    await onDuplicate(
      busEvent('duplicate.suspected', {
        ...suspected,
        eventId: 'event-dup-2',
        data: { reportId: 'report-9', matchedReportId: 'report-1', kind: 'photo' as const },
      }),
    );
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(2);
    expect(ddbMock.commandCalls(UpdateCommand)[1]?.args[0].input.Key).toEqual({
      reportId: 'report-9',
    });
  });
});
