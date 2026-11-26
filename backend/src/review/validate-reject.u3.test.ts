// 却下の理由の確認（BR3.8）
import { describe, expect, it } from 'vitest';
import { validateReject } from './validate-reject';

describe('validateReject', () => {
  it('4 つの理由のいずれかなら受け付ける', () => {
    expect(validateReject({ reason: 'duplicate' })).toEqual({ reason: 'duplicate' });
    expect(validateReject({ reason: 'insufficient-photo' })).toEqual({
      reason: 'insufficient-photo',
    });
    expect(validateReject({ reason: 'out-of-scope' })).toEqual({ reason: 'out-of-scope' });
  });

  it('知らない理由は 422', () => {
    expect(() => validateReject({ reason: 'because' })).toThrow();
    expect(() => validateReject({})).toThrow();
  });

  it('other は reasonText が 1〜200 文字で必須', () => {
    expect(validateReject({ reason: 'other', reasonText: '写真が不鮮明' })).toEqual({
      reason: 'other',
      reasonText: '写真が不鮮明',
    });
    expect(validateReject({ reason: 'other', reasonText: 'a'.repeat(200) })).toEqual({
      reason: 'other',
      reasonText: 'a'.repeat(200),
    });
  });

  it('other で reasonText が空・無しは 422', () => {
    expect(() => validateReject({ reason: 'other' })).toThrow();
    expect(() => validateReject({ reason: 'other', reasonText: '' })).toThrow();
  });

  it('other で reasonText が空白だけなら空として扱い 422（AC4.4.2）', () => {
    expect(() => validateReject({ reason: 'other', reasonText: '   　\n' })).toThrow();
  });

  it('other で reasonText が 201 文字は 422', () => {
    expect(() => validateReject({ reason: 'other', reasonText: 'a'.repeat(201) })).toThrow();
  });

  it('前後の空白は取り除いて保存する', () => {
    expect(validateReject({ reason: 'other', reasonText: '  不鮮明  ' })).toEqual({
      reason: 'other',
      reasonText: '不鮮明',
    });
  });
});
