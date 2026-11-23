// 実行時の設定（config.json）を読む。画面のビルドに API の URL などを埋め込まない（infrastructure-specification の WebContent）。
export interface AppConfig {
  apiBaseUrl: string;
  userPoolId?: string;
  userPoolClientId?: string;
  photoBucketUrl?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export async function loadConfig(
  fetchFn: typeof fetch = fetch,
  url = '/config.json',
): Promise<AppConfig> {
  let res: Response;
  try {
    res = await fetchFn(url, { cache: 'no-store' });
  } catch {
    throw new ConfigError('設定を読めませんでした。通信を確かめてください');
  }
  if (!res.ok) throw new ConfigError(`設定を読めませんでした（${res.status}）`);
  const data = (await res.json().catch(() => null)) as Partial<AppConfig> | null;
  if (!data || typeof data.apiBaseUrl !== 'string' || data.apiBaseUrl.length === 0) {
    throw new ConfigError('設定の形が正しくありません');
  }
  return { ...data, apiBaseUrl: data.apiBaseUrl.replace(/\/+$/, '') } as AppConfig;
}
