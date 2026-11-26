// 設定の値の範囲の確認・初期値の試験（BR9.2・BR9.3）
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isWithinTargetArea,
  validateSettingValues,
  withDefaults,
} from './validate';
import type { SettingRecord } from './repository';

const valid = {
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
};

describe('validateSettingValues', () => {
  it('正しい値は誤りなし', () => {
    expect(validateSettingValues(valid)).toEqual([]);
  });

  it('距離は 1 m 以上（0 以下は不可）', () => {
    expect(validateSettingValues({ ...valid, duplicateDistanceMeters: 0 })).toEqual([
      { field: 'duplicateDistanceMeters', reason: 'out-of-range' },
    ]);
    expect(validateSettingValues({ ...valid, duplicateDistanceMeters: 1 })).toEqual([]);
  });

  it('時間は 1 時間以上', () => {
    expect(validateSettingValues({ ...valid, duplicateWindowHours: 0 })).toEqual([
      { field: 'duplicateWindowHours', reason: 'out-of-range' },
    ]);
  });

  it('対象地域は北 > 南・東 > 西', () => {
    expect(validateSettingValues({ ...valid, targetAreaNorth: 20, targetAreaSouth: 20 })).toEqual([
      { field: 'targetAreaNorth', reason: 'must-exceed-south' },
    ]);
    expect(validateSettingValues({ ...valid, targetAreaEast: 122, targetAreaWest: 122 })).toEqual([
      { field: 'targetAreaEast', reason: 'must-exceed-west' },
    ]);
  });

  it('複数の誤りをまとめて返す', () => {
    expect(
      validateSettingValues({
        duplicateDistanceMeters: 0,
        duplicateWindowHours: 0,
        targetAreaNorth: 10,
        targetAreaSouth: 20,
        targetAreaEast: 100,
        targetAreaWest: 120,
      }),
    ).toHaveLength(4);
  });
});

describe('withDefaults', () => {
  it('行があればそのまま返す', () => {
    const record: SettingRecord = {
      settingKey: 'default',
      ...valid,
      updatedAt: '2026-11-01T00:00:00.000Z',
    };
    expect(withDefaults(record)).toBe(record);
  });

  it('行がなければ初期値（1,000m・24時間・日本の範囲）を返す（BR9.3）', () => {
    const now = () => new Date('2026-11-23T00:00:00.000Z');
    expect(withDefaults(undefined, now)).toEqual({
      ...DEFAULT_SETTINGS,
      updatedAt: '2026-11-23T00:00:00.000Z',
    });
  });
});

describe('isWithinTargetArea', () => {
  const settings: SettingRecord = {
    settingKey: 'default',
    ...valid,
    updatedAt: '2026-11-01T00:00:00.000Z',
  };

  it('範囲の中（境界を含む）なら true', () => {
    expect(isWithinTargetArea({ lat: 35, lng: 135 }, settings)).toBe(true);
    expect(isWithinTargetArea({ lat: 46, lng: 154 }, settings)).toBe(true);
    expect(isWithinTargetArea({ lat: 20, lng: 122 }, settings)).toBe(true);
  });

  it('範囲の外なら false', () => {
    expect(isWithinTargetArea({ lat: 47, lng: 135 }, settings)).toBe(false);
    expect(isWithinTargetArea({ lat: 35, lng: 155 }, settings)).toBe(false);
  });
});
