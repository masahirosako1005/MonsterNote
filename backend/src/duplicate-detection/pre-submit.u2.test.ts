// 送信の前の重複の問い合わせの試験（C9。BR7.1・BR7.3・BR8.5）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { checkDuplicate, isDuplicateCheckRequest, requireHunterCaller } from './pre-submit';
import { createDuplicateRepository } from './repository';
import { clients } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createDuplicateRepository(c.ddb, {
  footprints: 'ReportFootprints',
  suspicions: 'DuplicateSuspicions',
});

const settings = {
  settingKey: 'default',
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('checkDuplicate', () => {
  it('候補が見つかれば suspected=true と、氏名・写真を含まない相手の一覧を返す（BR7.3）', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          reportId: 'report-2',
          savedReceived: true,
          species: 'boar',
          location: { lat: 35, lng: 135 },
          capturedAt: '2026-11-20T03:30:00.000Z',
          speciesDay: 'boar#2026-11-20',
          active: true,
          addedAt: 'x',
        },
      ],
    });
    const result = await checkDuplicate(repo, settings, {
      species: 'boar',
      capturedAt: '2026-11-20T03:00:00.000Z',
      location: { lat: 35, lng: 135 },
    });
    expect(result.suspected).toBe(true);
    expect(result.matches).toEqual([
      { species: 'boar', capturedAt: '2026-11-20T03:30:00.000Z', distanceMeters: 0 },
    ]);
  });

  it('候補が見つからなければ suspected=false', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await checkDuplicate(repo, settings, {
      species: 'deer',
      capturedAt: '2026-11-20T03:00:00.000Z',
      location: { lat: 35, lng: 135 },
    });
    expect(result).toEqual({ suspected: false, matches: [] });
  });

  it('記録は作らない（BR8.5。PutCommand を呼ばない）', async () => {
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await checkDuplicate(repo, settings, {
      species: 'boar',
      capturedAt: '2026-11-20T03:00:00.000Z',
      location: { lat: 35, lng: 135 },
    });
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

describe('isDuplicateCheckRequest', () => {
  it('kind=duplicate-check の形だけを見分ける', () => {
    expect(
      isDuplicateCheckRequest({
        kind: 'duplicate-check',
        auth: { authKind: 'caller', caller: { sub: 'h', roles: ['hunter'] } },
        species: 'boar',
        capturedAt: 'x',
        location: { lat: 0, lng: 0 },
      }),
    ).toBe(true);
    expect(isDuplicateCheckRequest({ requestContext: {} })).toBe(false);
    expect(isDuplicateCheckRequest(null)).toBe(false);
  });
});

describe('requireHunterCaller', () => {
  it('ハンターなら通す。それ以外は拒む（ADR-011 ①）', () => {
    expect(() => requireHunterCaller({ accountId: 'h', roles: ['hunter'] })).not.toThrow();
    expect(() => requireHunterCaller({ accountId: 'r', roles: ['requester'] })).toThrow();
  });
});
