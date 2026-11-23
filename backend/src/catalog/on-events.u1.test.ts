// 一覧の行を知らせから作る試験（BR4.1、AC2.1.1・AC4.3.2、contract-summary 2.5 の順番の入れ替わり）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { createCatalogOnSaved } from './on-saved';
import { createCatalogOnStatus } from './on-status';
import { createCatalogRepository } from './repository';
import { createProcessedEvents } from '../shared/processed-events';
import { createLogger } from '../shared/logger';
import { busEvent } from '../../test/helpers/events';
import { clients, fixedNow } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createCatalogRepository(c.ddb, 'ReportListItems');
const logger = createLogger('catalog', () => undefined);
const onSaved = createCatalogOnSaved({
  repo,
  processed: createProcessedEvents(c.ddb, 'ProcessedEvents', 'catalog-on-saved', fixedNow()),
  logger,
});
const onStatus = createCatalogOnStatus({
  repo,
  processed: createProcessedEvents(c.ddb, 'ProcessedEvents', 'catalog-on-status', fixedNow()),
  logger,
});

const saved = {
  eventId: 'event-saved-1',
  type: 'report.saved',
  version: 1,
  occurredAt: '2026-11-23T03:00:01.000Z',
  source: 'Reporting',
  data: {
    reportId: 'report-1',
    hunterAccountId: 'hunter-a',
    hunterName: 'ハンター A',
    species: 'boar',
    capturedAt: '2026-11-23T03:00:00.000Z',
    location: { lat: 35, lng: 135 },
    manualEntry: false,
    submittedAt: '2026-11-23T03:00:00.000Z',
    bodyPhotoId: 'photo-1',
  },
};
const statusChanged = {
  eventId: 'event-status-1',
  type: 'review.status-changed',
  version: 1,
  occurredAt: '2026-11-23T04:00:00.000Z',
  source: 'Review',
  data: {
    reportId: 'report-1',
    status: 'approved',
    previousStatus: 'checking',
    changedAt: '2026-11-23T04:00:00.000Z',
  },
};

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
});

describe('catalog-on-saved', () => {
  it('report.saved で一覧の行の内容を入れ、savedReceived と索引のキーを書く', async () => {
    await onSaved(busEvent('report.saved', saved));
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.Key).toEqual({ reportId: 'report-1' });
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':hunterAccountId': 'hunter-a',
      ':hunterName': 'ハンター A',
      ':species': 'boar',
      ':savedReceived': true,
      ':listPartition': 'ALL',
      ':sortKey': '2026-11-23T03:00:00.000Z#report-1',
      ':checking': 'checking',
    });
    // 状態が先に届いていたら、その状態を残す（if_not_exists）
    expect(input?.UpdateExpression).toContain('if_not_exists(#status, :checking)');
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item?.consumerEventId).toBe(
      'catalog-on-saved#event-saved-1',
    );
  });

  it('同じ eventId の 2 回目は無視する', async () => {
    ddbMock
      .on(GetCommand)
      .resolves({ Item: { consumerEventId: 'catalog-on-saved#event-saved-1' } });
    await onSaved(busEvent('report.saved', saved));
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('古い report.saved（すでに新しいものを反映済み）は条件に合わず、無視して処理済みにする', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    await expect(onSaved(busEvent('report.saved', saved))).resolves.toBeUndefined();
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
  });

  it('表の失敗は例外にし、処理済みにしない', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('throttled'));
    await expect(onSaved(busEvent('report.saved', saved))).rejects.toThrow('throttled');
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

describe('catalog-on-status', () => {
  it('review.status-changed は、最後に反映したものより新しいときだけ状態を書き換える', async () => {
    await onStatus(busEvent('review.status-changed', statusChanged));
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.ConditionExpression).toBe(
      'attribute_not_exists(lastStatusEventAt) OR lastStatusEventAt < :occurredAt',
    );
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':status': 'approved',
      ':occurredAt': '2026-11-23T04:00:00.000Z',
    });
  });

  it('状態が保存の知らせより先に届いたら、状態を覚えておく（行はまだ一覧に出ない）', async () => {
    await onStatus(busEvent('review.status-changed', statusChanged));
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    // 一覧に出すかは savedReceived で決まり、状態だけの行では false のまま
    expect(input?.UpdateExpression).toContain(
      'savedReceived = if_not_exists(savedReceived, :false)',
    );
    expect(input?.UpdateExpression).not.toContain('sortKey');
  });

  it('古い状態の知らせは反映しない（条件に合わず無視）', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    await expect(
      onStatus(busEvent('review.status-changed', statusChanged)),
    ).resolves.toBeUndefined();
  });

  it('同じ eventId の 2 回目は無視する', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { consumerEventId: 'x' } });
    await onStatus(busEvent('review.status-changed', statusChanged));
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('形の壊れた知らせは例外にする', async () => {
    await expect(
      onStatus(busEvent('review.status-changed', { ...statusChanged, data: { reportId: 'r' } })),
    ).rejects.toThrow();
  });
});
