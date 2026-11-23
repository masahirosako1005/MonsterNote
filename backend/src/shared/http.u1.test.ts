// API Gateway の応答とエラーの変換の試験（contract-summary 2.2、observability: requestId をヘッダーに）
import { describe, expect, it } from 'vitest';
import { createHttpHandler, json, noContent, parseJsonBody } from './http';
import { errors } from './errors';
import { createLogger } from './logger';
import { apiEvent } from '../../test/helpers/events';

const silent = createLogger('test', () => undefined);

describe('json と noContent', () => {
  it('JSON の応答に x-request-id を付ける', () => {
    const res = json(201, { reportId: 'r-1' }, 'req-9');
    expect(res).toEqual({
      statusCode: 201,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-9' },
      body: JSON.stringify({ reportId: 'r-1' }),
    });
    expect(noContent('req-9')).toEqual({ statusCode: 204, headers: { 'x-request-id': 'req-9' } });
  });
});

describe('parseJsonBody', () => {
  it('JSON の本文を読む。本文がなければ空の物', () => {
    expect(parseJsonBody(apiEvent({ body: { a: 1 } }))).toEqual({ a: 1 });
    expect(parseJsonBody(apiEvent({}))).toEqual({});
  });

  it('壊れた JSON・物でない JSON は 400', () => {
    expect(() => parseJsonBody(apiEvent({ rawBody: '{oops' }))).toThrowError(
      expect.objectContaining({ status: 400, code: 'VALIDATION_FAILED' }),
    );
    expect(() => parseJsonBody(apiEvent({ rawBody: '[1,2]' }))).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('Base64 の本文を読む', () => {
    const ev = apiEvent({ rawBody: Buffer.from('{"x":true}').toString('base64') });
    ev.isBase64Encoded = true;
    expect(parseJsonBody(ev)).toEqual({ x: true });
  });
});

describe('createHttpHandler', () => {
  it('routeKey で処理を選び、その結果を返す', async () => {
    const handler = createHttpHandler(
      { 'GET /v1/ping': async () => json(200, { ok: true }, 'r') },
      silent,
    );
    const res = await handler(apiEvent({ routeKey: 'GET /v1/ping' }));
    expect(res.statusCode).toBe(200);
  });

  it('AppError は共通のエラーの形の応答にする', async () => {
    const handler = createHttpHandler(
      {
        'GET /v1/x': async () => {
          throw errors.forbidden();
        },
      },
      silent,
    );
    const res = await handler(apiEvent({ routeKey: 'GET /v1/x', requestId: 'req-3' }));
    expect(res.statusCode).toBe(403);
    expect(res.headers?.['x-request-id']).toBe('req-3');
    expect(JSON.parse(res.body ?? '')).toEqual({
      code: 'FORBIDDEN',
      message: 'この操作はできません',
    });
  });

  it('知らない例外は 500 にしてログに残す', async () => {
    const lines: string[] = [];
    const handler = createHttpHandler(
      {
        'GET /v1/x': async () => {
          throw new Error('boom');
        },
      },
      createLogger('test', (l) => lines.push(l)),
    );
    const res = await handler(apiEvent({ routeKey: 'GET /v1/x' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body ?? '').code).toBe('INTERNAL_ERROR');
    expect(lines.some((l) => l.includes('INTERNAL_ERROR'))).toBe(true);
  });

  it('道がなければ 404', async () => {
    const handler = createHttpHandler({}, silent);
    const res = await handler(apiEvent({ routeKey: 'GET /v1/none' }));
    expect(res.statusCode).toBe(404);
  });
});
