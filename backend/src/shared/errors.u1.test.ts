// 共通のエラーの形の試験（contract-summary 2.2: code・message・details・conflict と状態番号）
import { describe, expect, it } from 'vitest';
import { AppError, errors, toAppError } from './errors';

describe('errors', () => {
  it('入力の誤りは 400 VALIDATION_FAILED で、足りない項目を details に入れる', () => {
    const err = errors.validation([{ field: 'species', reason: 'required' }]);
    expect(err.status).toBe(400);
    expect(err.toBody()).toEqual({
      code: 'VALIDATION_FAILED',
      message: '入力に誤りがあります',
      details: [{ field: 'species', reason: 'required' }],
    });
  });

  it('401・403・404 の状態番号と code', () => {
    expect(errors.unauthenticated()).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(errors.forbidden()).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(errors.notFound()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(errors.notFound('まだです', 'REVIEW_NOT_READY')).toMatchObject({
      status: 404,
      code: 'REVIEW_NOT_READY',
      message: 'まだです',
    });
  });

  it('409 は conflict に詳細を入れる（ALREADY_DECIDED）', () => {
    const err = errors.conflict('ALREADY_DECIDED', 'すでに確認済みです', {
      decision: 'approved',
      decidedByName: '依頼元 A',
    });
    expect(err.status).toBe(409);
    expect(err.toBody()).toEqual({
      code: 'ALREADY_DECIDED',
      message: 'すでに確認済みです',
      conflict: { decision: 'approved', decidedByName: '依頼元 A' },
    });
  });

  it('422 は業務の決まりの違反（CONSENT_REQUIRED）。details がなければ出さない', () => {
    const err = errors.unprocessable('CONSENT_REQUIRED', '同意が必要です');
    expect(err.status).toBe(422);
    expect(err.toBody()).toEqual({ code: 'CONSENT_REQUIRED', message: '同意が必要です' });
  });

  it('知らない例外は 500 INTERNAL_ERROR にし、中身を利用者に見せない', () => {
    const err = toAppError(new Error('DynamoDB の内部の話'));
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).not.toContain('DynamoDB');
    const known = errors.forbidden();
    expect(toAppError(known)).toBe(known);
  });
});
