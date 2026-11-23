// 共通のロガーの試験（NFR5.5: 氏名・位置・従事者番号・トークン・URL をログに出さない）
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

function capture() {
  const lines: string[] = [];
  const sink = (line: string) => lines.push(line);
  return { lines, sink, parsed: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
}

describe('createLogger', () => {
  it('1 行の JSON で、時刻・レベル・関数の名前・メッセージを出す', () => {
    const out = capture();
    const log = createLogger('reporting', out.sink, () => new Date('2026-11-23T01:02:03Z'));
    log.info('報告を保存した', { requestId: 'req-1', status: 201, accountId: 'hunter-a' });
    expect(out.parsed()[0]).toEqual({
      timestamp: '2026-11-23T01:02:03.000Z',
      level: 'info',
      function: 'reporting',
      message: '報告を保存した',
      requestId: 'req-1',
      status: 201,
      accountId: 'hunter-a',
    });
  });

  it('出してよい項目の一覧にない項目（氏名・位置・従事者番号・トークン・URL）は出さない', () => {
    const out = capture();
    const log = createLogger('accounts', out.sink);
    log.info('ログイン', {
      requestId: 'req-2',
      displayName: '山田 太郎',
      hunterName: '山田 太郎',
      location: { lat: 35.1, lng: 139.1 },
      lat: 35.1,
      hunterNumber: '12345',
      idToken: 'eyJ.secret',
      refreshToken: 'secret',
      uploadUrl: 'https://bucket.s3.amazonaws.com/photos/x',
      url: 'https://example.test',
    } as Record<string, unknown>);
    const line = out.lines[0] ?? '';
    expect(line).not.toMatch(/山田|35\.1|12345|eyJ|secret|https:/);
    expect(JSON.parse(line)).toMatchObject({ requestId: 'req-2' });
  });

  it('warn と error はレベルを分けて出し、errorCode と durationMs を残す', () => {
    const out = capture();
    const log = createLogger('reporting', out.sink);
    log.warn('知らせの送信のやり直し', { errorCode: 'EVENT_PUBLISH_RETRY', durationMs: 12 });
    log.error('知らせを送れなかった', {
      errorCode: 'EVENT_PUBLISH_FAILED',
      route: 'POST /v1/reports',
    });
    const [warn, error] = out.parsed();
    expect(warn).toMatchObject({ level: 'warn', errorCode: 'EVENT_PUBLISH_RETRY', durationMs: 12 });
    expect(error).toMatchObject({
      level: 'error',
      errorCode: 'EVENT_PUBLISH_FAILED',
      route: 'POST /v1/reports',
    });
  });

  it('項目の値が文字・数・真偽値以外（物）なら出さない', () => {
    const out = capture();
    const log = createLogger('catalog', out.sink);
    log.info('一覧', { requestId: { nested: 'x' } as unknown as string, eventId: 'ev-1' });
    const parsed = out.parsed()[0];
    expect(parsed).not.toHaveProperty('requestId');
    expect(parsed).toMatchObject({ eventId: 'ev-1' });
  });

  it('既定では console.log に出す', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    createLogger('review').info('承認');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
