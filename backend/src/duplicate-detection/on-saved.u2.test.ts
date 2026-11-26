// report.saved を受けた保存後の重複判定の試験（BR8.4・BR8.6・BR8.11）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createDuplicateOnSaved } from './on-saved';
import { createDuplicateRepository } from './repository';
import { createProcessedEvents } from '../shared/processed-events';
import { createLogger } from '../shared/logger';
import { busEvent } from '../../test/helpers/events';
import { clients, fixedNow, sequenceIds } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const c = clients();
const repo = createDuplicateRepository(c.ddb, {
  footprints: 'ReportFootprints',
  suspicions: 'DuplicateSuspicions',
});
const logger = createLogger('duplicate-detection-on-saved', () => undefined);
const settingsRecord = {
  settingKey: 'default',
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

function makeOnSaved() {
  return createDuplicateOnSaved({
    repo,
    processed: createProcessedEvents(
      c.ddb,
      'ProcessedEvents',
      'duplicate-detection-on-saved',
      fixedNow(),
    ),
    logger,
    readSettings: async () => settingsRecord,
    eventBridge: c.eventBridge,
    busName: 'bus',
    now: fixedNow('2026-11-20T04:00:00.000Z'),
    newId: sequenceIds('det-1'),
    publishOptions: { sleep: async () => undefined },
  });
}

const saved = (reportId = 'report-1', hunter = 'hunter-a') => ({
  eventId: `event-${reportId}`,
  type: 'report.saved',
  version: 1,
  occurredAt: '2026-11-20T04:00:00.000Z',
  source: 'Reporting',
  data: {
    reportId,
    hunterAccountId: hunter,
    hunterName: 'ハンター',
    species: 'boar',
    capturedAt: '2026-11-20T03:00:00.000Z',
    location: { lat: 35, lng: 135 },
    manualEntry: false,
    submittedAt: '2026-11-20T04:00:00.000Z',
    bodyPhotoId: 'photo-1',
  },
});

const existingMatch = {
  reportId: 'report-2',
  savedReceived: true,
  species: 'boar',
  location: { lat: 35, lng: 135 },
  capturedAt: '2026-11-20T03:30:00.000Z',
  speciesDay: 'boar#2026-11-20',
  active: true,
  hunterAccountId: 'hunter-b',
  addedAt: '2026-11-20T03:30:00.000Z',
};

beforeEach(() => {
  ddbMock.reset();
  ebMock.reset();
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
});

describe('createDuplicateOnSaved', () => {
  it('索引に自分を加える（新規）', async () => {
    const onSaved = makeOnSaved();
    await onSaved(busEvent('report.saved', saved()));
    const footprintPut = ddbMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input)
      .find((i) => i.TableName === 'ReportFootprints');
    expect(footprintPut?.Item).toMatchObject({
      reportId: 'report-1',
      savedReceived: true,
      species: 'boar',
      speciesDay: 'boar#2026-11-20',
      active: true,
    });
  });

  it('先に届いた却下の状態（active=false）があれば、それを残す（BR8.11）', async () => {
    ddbMock.on(GetCommand, { TableName: 'ReportFootprints' }).resolves({
      Item: {
        reportId: 'report-1',
        savedReceived: false,
        active: false,
        addedAt: '2026-11-20T03:00:00.000Z',
        lastStatusEventAt: '2026-11-20T03:00:00.000Z',
      },
    });
    const onSaved = makeOnSaved();
    await onSaved(busEvent('report.saved', saved()));
    const footprintPut = ddbMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input)
      .find((i) => i.TableName === 'ReportFootprints');
    expect(footprintPut?.Item).toMatchObject({ active: false, savedReceived: true });
  });

  it('見つかった相手ごとに疑いを 2 行作り、行ごとに duplicate.suspected を送る（BR8.4）', async () => {
    ddbMock
      .on(QueryCommand, { TableName: 'ReportFootprints' })
      .resolves({ Items: [existingMatch] });
    const onSaved = makeOnSaved();
    await onSaved(busEvent('report.saved', saved('report-1')));
    const suspicionPuts = ddbMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input)
      .filter((i) => i.TableName === 'DuplicateSuspicions');
    expect(suspicionPuts).toHaveLength(2);
    expect(suspicionPuts.map((p) => p.Item?.suspicionId).sort()).toEqual(
      ['report-1#report-2#place-time', 'report-2#report-1#place-time'].sort(),
    );
    const sentTypes = ebMock
      .commandCalls(PutEventsCommand)
      .map((c) => c.args[0].input.Entries?.[0]?.DetailType);
    // U4: duplicate.suspected の行ごとに audit.recorded も送る（BR12.5）
    expect(sentTypes).toEqual([
      'duplicate.suspected',
      'audit.recorded',
      'duplicate.suspected',
      'audit.recorded',
    ]);
  });

  it('同じ組は作り直さない。知らせも送り直さない（BR8.6）', async () => {
    ddbMock
      .on(QueryCommand, { TableName: 'ReportFootprints' })
      .resolves({ Items: [existingMatch] });
    ddbMock
      .on(PutCommand, { TableName: 'DuplicateSuspicions' })
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const onSaved = makeOnSaved();
    await onSaved(busEvent('report.saved', saved('report-1')));
    expect(ebMock.commandCalls(PutEventsCommand)).toHaveLength(0);
  });

  it('知らせが送れなくても、判定自体は失敗にしない（NFR10.16）', async () => {
    ddbMock
      .on(QueryCommand, { TableName: 'ReportFootprints' })
      .resolves({ Items: [existingMatch] });
    ebMock.on(PutEventsCommand).rejects(new Error('down'));
    const onSaved = makeOnSaved();
    await expect(onSaved(busEvent('report.saved', saved('report-1')))).resolves.toBeUndefined();
  });

  it('同じ eventId の 2 回目は無視する', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'ProcessedEvents' })
      .resolves({ Item: { consumerEventId: 'x' } });
    const onSaved = makeOnSaved();
    await onSaved(busEvent('report.saved', saved()));
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('形の壊れた知らせは例外にする', async () => {
    const onSaved = makeOnSaved();
    await expect(
      onSaved(busEvent('report.saved', { ...saved(), data: { reportId: 'r' } })),
    ).rejects.toThrow();
  });
});
