// 応答の項目の絞り込みの試験（NFR5.7・BR7.3: species・capturedAt・distanceMeters〈100m単位〉だけを返す）
import { describe, expect, it } from 'vitest';
import { roundDistanceMeters, trimMatch, trimMatches } from './response-shape';
import type { MatchCandidate } from './match';
import type { ReportFootprintRecord } from './repository';

const footprint: ReportFootprintRecord = {
  reportId: 'report-2',
  hunterAccountId: 'hunter-b',
  savedReceived: true,
  species: 'boar',
  location: { lat: 35.01, lng: 135.01 },
  capturedAt: '2026-11-20T04:00:00.000Z',
  speciesDay: 'boar#2026-11-20',
  active: true,
  addedAt: '2026-11-20T04:00:00.000Z',
};

const match: MatchCandidate = { footprint, distanceMeters: 742, hoursApart: 1.5 };

describe('roundDistanceMeters', () => {
  it('100 m 単位に丸める', () => {
    expect(roundDistanceMeters(0)).toBe(0);
    expect(roundDistanceMeters(49)).toBe(0);
    expect(roundDistanceMeters(50)).toBe(100);
    expect(roundDistanceMeters(742)).toBe(700);
    expect(roundDistanceMeters(999)).toBe(1000);
  });
});

describe('trimMatch', () => {
  it('species・capturedAt・distanceMeters だけを返す', () => {
    expect(trimMatch(match)).toEqual({
      species: 'boar',
      capturedAt: '2026-11-20T04:00:00.000Z',
      distanceMeters: 700,
    });
  });

  it('reportId・hunterAccountId・location は含めない（氏名・写真は入れない。BR7.3）', () => {
    const trimmed = trimMatch(match) as unknown as Record<string, unknown>;
    expect(trimmed.reportId).toBeUndefined();
    expect(trimmed.hunterAccountId).toBeUndefined();
    expect(trimmed.location).toBeUndefined();
    expect(Object.keys(trimmed).sort()).toEqual(['capturedAt', 'distanceMeters', 'species']);
  });
});

describe('trimMatches', () => {
  it('複数件をまとめて絞り込む', () => {
    expect(trimMatches([match, match])).toHaveLength(2);
  });
});
