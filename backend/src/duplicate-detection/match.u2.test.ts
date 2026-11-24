// 重複判定のハバーサイン距離計算・候補の絞り方の試験（BR8.1〜BR8.3）
import { describe, expect, it, vi } from 'vitest';
import {
  findMatches,
  halfRangeDays,
  haversineMeters,
  speciesDayKeysAround,
  speciesDayKeyOf,
  suspicionIdOf,
} from './match';
import type { DuplicateRepository, ReportFootprintRecord } from './repository';
import type { SettingRecord } from '../settings/repository';

const settings: SettingRecord = {
  settingKey: 'default',
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
  updatedAt: '2026-11-23T00:00:00.000Z',
};

describe('haversineMeters', () => {
  it('同じ地点は 0 m', () => {
    expect(haversineMeters({ lat: 35, lng: 135 }, { lat: 35, lng: 135 })).toBe(0);
  });

  it('緯度 1 度の差はおよそ 111 km（1 m の誤差を許す。rules.md）', () => {
    const d = haversineMeters({ lat: 35, lng: 135 }, { lat: 36, lng: 135 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('speciesDayKeysAround / halfRangeDays', () => {
  it('24 時間以内の基準では前後 1 日ずつ、あわせて 3 日分（BR8.3）', () => {
    expect(halfRangeDays(24)).toBe(1);
    expect(speciesDayKeysAround('boar', '2026-11-20T03:00:00.000Z', 24)).toEqual([
      'boar#2026-11-19',
      'boar#2026-11-20',
      'boar#2026-11-21',
    ]);
  });

  it('基準が 24 時間を超えると読む日数を広げる（assumption）', () => {
    expect(halfRangeDays(48)).toBe(2);
    expect(speciesDayKeysAround('bear', '2026-11-20T03:00:00.000Z', 48)).toHaveLength(5);
  });

  it('speciesDayKeyOf は UTC の日付で切る', () => {
    expect(speciesDayKeyOf('deer', '2026-11-20T23:59:59.000Z')).toBe('deer#2026-11-20');
  });
});

function repoWithFootprints(byKey: Record<string, ReportFootprintRecord[]>): DuplicateRepository {
  return {
    getFootprint: vi.fn(),
    putFootprint: vi.fn(),
    putSuspicionIfAbsent: vi.fn(),
    listSuspicionsByReport: vi.fn(),
    queryBySpeciesDay: vi.fn(async (key: string) => byKey[key] ?? []),
  } as unknown as DuplicateRepository;
}

const activeBoar = (overrides: Partial<ReportFootprintRecord> = {}): ReportFootprintRecord => ({
  reportId: 'report-2',
  savedReceived: true,
  species: 'boar',
  location: { lat: 35, lng: 135 },
  capturedAt: '2026-11-20T04:00:00.000Z',
  speciesDay: 'boar#2026-11-20',
  active: true,
  addedAt: '2026-11-20T04:00:00.000Z',
  ...overrides,
});

describe('findMatches', () => {
  const target = {
    species: 'boar' as const,
    capturedAt: '2026-11-20T03:00:00.000Z',
    location: { lat: 35, lng: 135 },
  };

  it('距離・時間差が基準以内の相手を見つける（BR8.1。ちょうど境界も含む）', async () => {
    const repo = repoWithFootprints({ 'boar#2026-11-20': [activeBoar()] });
    const matches = await findMatches(repo, target, settings);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.footprint.reportId).toBe('report-2');
    expect(matches[0]?.distanceMeters).toBe(0);
    expect(matches[0]?.hoursApart).toBe(1);
  });

  it('基準を超える距離・時間差の相手は含めない', async () => {
    const far = activeBoar({ location: { lat: 36, lng: 135 } }); // 約 111km > 1000m
    const repo = repoWithFootprints({ 'boar#2026-11-20': [far] });
    expect(await findMatches(repo, target, settings)).toEqual([]);
  });

  it('種類が違う相手は候補にしない', async () => {
    const repo = repoWithFootprints({
      'boar#2026-11-20': [activeBoar({ species: 'deer' })],
    });
    expect(await findMatches(repo, target, settings)).toEqual([]);
  });

  it('却下された相手（active=false）は候補にしない（BR8.7）', async () => {
    const repo = repoWithFootprints({ 'boar#2026-11-20': [activeBoar({ active: false })] });
    expect(await findMatches(repo, target, settings)).toEqual([]);
  });

  it('report.saved がまだ届いていない相手（savedReceived=false）は候補にしない（BR8.11）', async () => {
    const repo = repoWithFootprints({
      'boar#2026-11-20': [
        activeBoar({
          savedReceived: false,
          species: undefined,
          location: undefined,
          capturedAt: undefined,
        }),
      ],
    });
    expect(await findMatches(repo, target, settings)).toEqual([]);
  });

  it('excludeReportId を自分自身として候補から除く（保存後の再判定）', async () => {
    const repo = repoWithFootprints({ 'boar#2026-11-20': [activeBoar({ reportId: 'report-1' })] });
    expect(await findMatches(repo, { ...target, excludeReportId: 'report-1' }, settings)).toEqual(
      [],
    );
  });

  it('前後の日にまたがる相手も見つける（BR8.3）', async () => {
    const repo = repoWithFootprints({
      'boar#2026-11-19': [
        activeBoar({ reportId: 'report-3', capturedAt: '2026-11-19T23:00:00.000Z' }),
      ],
    });
    const matches = await findMatches(repo, target, settings);
    expect(matches.map((m) => m.footprint.reportId)).toEqual(['report-3']);
  });
});

describe('suspicionIdOf', () => {
  it('reportId・matchedReportId・kind から決める。方向ごとに別の ID になる（BR8.6）', () => {
    expect(suspicionIdOf('report-1', 'report-2', 'place-time')).toBe(
      'report-1#report-2#place-time',
    );
    expect(suspicionIdOf('report-2', 'report-1', 'place-time')).toBe(
      'report-2#report-1#place-time',
    );
  });
});
