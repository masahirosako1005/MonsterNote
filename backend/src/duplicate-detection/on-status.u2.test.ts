// review.status-changed を受けた索引の出し入れの試験（BR8.7・BR8.11、contract-summary 2.5）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDuplicateOnStatus } from './on-status';
import { createDuplicateRepository } from './repository';
import { createProcessedEvents } from '../shared/processed-events';
import { createLogger } from '../shared/logger';
import { busEvent } from '../../test/helpers/events';
import { clients, fixedNow } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createDuplicateRepository(c.ddb, {
  footprints: 'ReportFootprints',
  suspicions: 'DuplicateSuspicions',
});
const logger = createLogger('duplicate-detection-on-status', () => undefined);

function makeOnStatus(now = fixedNow('2026-11-20T05:00:00.000Z')) {
  return createDuplicateOnStatus({
    repo,
    processed: createProcessedEvents(
      c.ddb,
      'ProcessedEvents',
      'duplicate-detection-on-status',
      now,
    ),
    logger,
    now,
  });
}

const statusChanged = (status: 'checking' | 'approved' | 'rejected', occurredAt: string) => ({
  eventId: `event-${status}-${occurredAt}`,
  type: 'review.status-changed',
  version: 1,
  occurredAt,
  source: 'Review',
  data: { reportId: 'report-1', status, previousStatus: 'checking', changedAt: occurredAt },
});

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
});

describe('createDuplicateOnStatus', () => {
  it('行がまだないとき、却下なら active=false の「状態だけ」の行を作る（BR8.11）', async () => {
    const onStatus = makeOnStatus();
    await onStatus(
      busEvent('review.status-changed', statusChanged('rejected', '2026-11-20T05:00:00.000Z')),
    );
    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.TableName).toBe('ReportFootprints');
    expect(put?.Item).toMatchObject({
      reportId: 'report-1',
      savedReceived: false,
      active: false,
    });
  });

  it('行がすでにあるとき、却下で active=false にする（BR8.7）。種類・場所は保つ', async () => {
    ddbMock.on(GetCommand, { TableName: 'ReportFootprints' }).resolves({
      Item: {
        reportId: 'report-1',
        savedReceived: true,
        species: 'boar',
        location: { lat: 35, lng: 135 },
        capturedAt: '2026-11-20T03:00:00.000Z',
        speciesDay: 'boar#2026-11-20',
        active: true,
        addedAt: '2026-11-20T03:00:00.000Z',
        lastSavedEventAt: '2026-11-20T03:00:00.000Z',
      },
    });
    const onStatus = makeOnStatus();
    await onStatus(
      busEvent('review.status-changed', statusChanged('rejected', '2026-11-20T05:00:00.000Z')),
    );
    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.Item).toMatchObject({
      active: false,
      species: 'boar',
      speciesDay: 'boar#2026-11-20',
    });
  });

  it('却下の取り消し（previousStatus=rejected・undone扱いで status≠rejected）で active=true に戻す', async () => {
    ddbMock.on(GetCommand, { TableName: 'ReportFootprints' }).resolves({
      Item: {
        reportId: 'report-1',
        savedReceived: true,
        active: false,
        addedAt: 'x',
        lastStatusEventAt: '2026-11-20T04:00:00.000Z',
      },
    });
    const onStatus = makeOnStatus();
    await onStatus(
      busEvent('review.status-changed', statusChanged('checking', '2026-11-20T05:00:00.000Z')),
    );
    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.Item).toMatchObject({ active: true });
  });

  it('覚えている時刻より古い知らせは無視する（contract-summary 2.5）', async () => {
    ddbMock.on(GetCommand, { TableName: 'ReportFootprints' }).resolves({
      Item: {
        reportId: 'report-1',
        savedReceived: true,
        active: true,
        addedAt: 'x',
        lastStatusEventAt: '2026-11-20T06:00:00.000Z',
      },
    });
    const onStatus = makeOnStatus();
    await onStatus(
      busEvent('review.status-changed', statusChanged('rejected', '2026-11-20T05:00:00.000Z')),
    );
    // 索引（ReportFootprints）は書き換えない（処理済みの記録〈ProcessedEvents〉は残してよい）
    expect(ddbMock.commandCalls(PutCommand, { TableName: 'ReportFootprints' })).toHaveLength(0);
  });

  it('同じ eventId の 2 回目は無視する', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'ProcessedEvents' })
      .resolves({ Item: { consumerEventId: 'x' } });
    const onStatus = makeOnStatus();
    await onStatus(
      busEvent('review.status-changed', statusChanged('rejected', '2026-11-20T05:00:00.000Z')),
    );
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('形の壊れた知らせは例外にする', async () => {
    const onStatus = makeOnStatus();
    await expect(
      onStatus(
        busEvent('review.status-changed', {
          ...statusChanged('rejected', 'x'),
          data: { reportId: 'r' },
        }),
      ),
    ).rejects.toThrow();
  });
});
