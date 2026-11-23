// 認可の共通の処理の試験（BR1.2・BR1.4・NFR4.3、AC1.1.4・AC5.1.3）
import { describe, expect, it } from 'vitest';
import { getCaller, hasRole, requireOwner, requireRole } from './auth';
import { AppError } from './errors';
import { apiEvent } from '../../test/helpers/events';

describe('getCaller', () => {
  it('証明の claims（sub・cognito:groups）から利用者の ID と役割を読む', () => {
    const caller = getCaller(
      apiEvent({ claims: { sub: 'hunter-a', 'cognito:groups': '[hunter]', name: 'ハンター A' } }),
    );
    expect(caller).toEqual({ accountId: 'hunter-a', roles: ['hunter'], name: 'ハンター A' });
  });

  it('API Gateway が配列を空白区切りの文字列にした形と、配列の形の両方を読む', () => {
    const fromString = getCaller(
      apiEvent({ claims: { sub: 'x', 'cognito:groups': '[requester admin]' } }),
    );
    expect(fromString.roles).toEqual(['requester', 'admin']);
    const fromArray = getCaller(
      apiEvent({ claims: { sub: 'x', 'cognito:groups': ['requester'] as unknown as string } }),
    );
    expect(fromArray.roles).toEqual(['requester']);
  });

  it('知らない役割の名前は無視する', () => {
    const caller = getCaller(apiEvent({ claims: { sub: 'x', 'cognito:groups': '[hunter root]' } }));
    expect(caller.roles).toEqual(['hunter']);
  });

  it('証明がない（claims がない・sub がない）ときは 401', () => {
    expect(() => getCaller(apiEvent({ claims: undefined }))).toThrowError(
      expect.objectContaining({ status: 401, code: 'UNAUTHENTICATED' }),
    );
    expect(() => getCaller(apiEvent({ claims: { 'cognito:groups': '[hunter]' } }))).toThrowError(
      AppError,
    );
  });
});

describe('requireRole', () => {
  it('許された役割なら何もしない', () => {
    expect(() => requireRole({ accountId: 'a', roles: ['requester'] }, 'requester')).not.toThrow();
  });

  it('役割が足りないと 403 FORBIDDEN（ハンターが承認の API を呼ぶ）', () => {
    expect(() => requireRole({ accountId: 'a', roles: ['hunter'] }, 'requester')).toThrowError(
      expect.objectContaining({ status: 403, code: 'FORBIDDEN' }),
    );
  });

  it('役割を持たない利用者は 403', () => {
    expect(() => requireRole({ accountId: 'a', roles: [] }, 'hunter', 'requester')).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });
});

describe('requireOwner と hasRole', () => {
  it('持ち主なら何もしない', () => {
    expect(() =>
      requireOwner({ accountId: 'hunter-a', roles: ['hunter'] }, 'hunter-a'),
    ).not.toThrow();
  });

  it('持ち主でないと 403（ハンター A が B の報告を読む）', () => {
    expect(() =>
      requireOwner({ accountId: 'hunter-a', roles: ['hunter'] }, 'hunter-b'),
    ).toThrowError(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));
  });

  it('hasRole は役割を持つかを返す', () => {
    expect(hasRole({ accountId: 'a', roles: ['hunter'] }, 'hunter')).toBe(true);
    expect(hasRole({ accountId: 'a', roles: ['hunter'] }, 'requester')).toBe(false);
  });
});
