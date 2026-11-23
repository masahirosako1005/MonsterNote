// 実行時の設定 config.json を読む loadConfig の試験
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw-server';
import { ConfigError, loadConfig } from './config';

const URL_ = 'http://web.test/config.json';

describe('loadConfig', () => {
  it('config.json の API の URL を読み、末尾の / を落とす', async () => {
    server.use(
      http.get(URL_, () => HttpResponse.json({ apiBaseUrl: 'https://api.test/', userPoolId: 'p' })),
    );
    await expect(loadConfig(fetch, URL_)).resolves.toEqual({
      apiBaseUrl: 'https://api.test',
      userPoolId: 'p',
    });
  });

  it('読めない（404）と ConfigError', async () => {
    server.use(http.get(URL_, () => new HttpResponse(null, { status: 404 })));
    await expect(loadConfig(fetch, URL_)).rejects.toBeInstanceOf(ConfigError);
  });

  it('API の URL がない・JSON でないと ConfigError', async () => {
    server.use(http.get(URL_, () => HttpResponse.json({})));
    await expect(loadConfig(fetch, URL_)).rejects.toThrow('設定の形が正しくありません');
    server.use(http.get(URL_, () => HttpResponse.text('oops')));
    await expect(loadConfig(fetch, URL_)).rejects.toBeInstanceOf(ConfigError);
  });

  it('通信できないと ConfigError', async () => {
    server.use(http.get(URL_, () => HttpResponse.error()));
    await expect(loadConfig(fetch, URL_)).rejects.toThrow('通信');
  });
});
