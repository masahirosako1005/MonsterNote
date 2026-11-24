// 種類の判別のしきい値判定の試験（BR6.1・BR6.3）
import { describe, expect, it } from 'vitest';
import { classifyLabels, classifyServiceFailure, CONFIDENCE_THRESHOLD } from './classify';

describe('classifyLabels', () => {
  it('最大の確からしさが 80% 以上なら detected（境界を含む）', () => {
    expect(
      classifyLabels([
        { name: 'Wildlife', confidence: 99 },
        { name: 'Boar', confidence: CONFIDENCE_THRESHOLD },
      ]),
    ).toEqual({ outcome: 'detected', species: 'boar', confidence: 80 });
  });

  it('複数の種類のラベルがあるとき、最大の確からしさの種類を選ぶ', () => {
    expect(
      classifyLabels([
        { name: 'Deer', confidence: 85 },
        { name: 'Bear', confidence: 91 },
      ]),
    ).toEqual({ outcome: 'detected', species: 'bear', confidence: 91 });
  });

  it('79% は low-confidence（動物は見つかったが足りない）', () => {
    expect(classifyLabels([{ name: 'Boar', confidence: 79 }])).toEqual({
      outcome: 'undetected',
      failureReason: 'low-confidence',
    });
  });

  it('動物そのものが見つからないときは no-animal', () => {
    expect(classifyLabels([{ name: 'Tree', confidence: 99 }])).toEqual({
      outcome: 'undetected',
      failureReason: 'no-animal',
    });
    expect(classifyLabels([])).toEqual({ outcome: 'undetected', failureReason: 'no-animal' });
  });

  it('ラベル名の大文字・小文字を区別しない', () => {
    expect(classifyLabels([{ name: 'DEER', confidence: 85 }])).toMatchObject({ species: 'deer' });
  });
});

describe('classifyServiceFailure', () => {
  it('時間切れ・サービスの失敗を undetected として返す（BR6.3）', () => {
    expect(classifyServiceFailure('timeout')).toEqual({
      outcome: 'undetected',
      failureReason: 'timeout',
    });
    expect(classifyServiceFailure('service-error')).toEqual({
      outcome: 'undetected',
      failureReason: 'service-error',
    });
  });
});
