// API の呼び出し（apiClient）。証明を Bearer で付け、10 秒で時間切れ（contract-summary 2.3）、
// エラーは共通の形（code・message・conflict）を ApiError にし、問い合わせ番号（x-request-id）を持たせる。
// 401 のときは、証明の出し直し（onUnauthorized）を 1 回だけ試してから呼び直す。

export class ApiError extends Error {
  readonly requestId?: string;
  readonly conflict?: Record<string, unknown>;
  readonly details?: { field: string; reason: string }[];

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    extra: {
      requestId?: string;
      conflict?: Record<string, unknown>;
      details?: { field: string; reason: string }[];
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.requestId = extra.requestId;
    this.conflict = extra.conflict;
    this.details = extra.details;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Bearer に付ける証明。ログインの道では使わない */
  getToken?: () => string | undefined;
  /** 401 のときに証明を出し直す。出し直せたら true */
  onUnauthorized?: () => Promise<boolean>;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface RequestOptions {
  body?: unknown;
  /** 証明を付けない（ログイン・出し直し） */
  anonymous?: boolean;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const NETWORK_ERROR_MESSAGE = '通信できませんでした。電波のよい所でもう一度お試しください';

export function createApiClient(options: ApiClientOptions) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchFn = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function once(method: string, path: string, req: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {};
    if (req.body !== undefined) headers['content-type'] = 'application/json';
    const token = req.anonymous ? undefined : options.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchFn(`${options.baseUrl}${path}`, {
        method,
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, 'NETWORK', NETWORK_ERROR_MESSAGE);
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T>(method: string, path: string, req: RequestOptions = {}): Promise<T> {
    let res = await once(method, path, req);
    if (res.status === 401 && !req.anonymous && options.onUnauthorized) {
      if (await options.onUnauthorized()) res = await once(method, path, req);
    }
    const requestId = res.headers.get('x-request-id') ?? undefined;
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined;
    if (!res.ok) {
      throw new ApiError(
        res.status,
        typeof data?.code === 'string' ? data.code : 'HTTP_ERROR',
        typeof data?.message === 'string' ? data.message : 'うまくいきませんでした',
        {
          requestId,
          conflict: data?.conflict as Record<string, unknown> | undefined,
          details: data?.details as { field: string; reason: string }[] | undefined,
        },
      );
    }
    return data as T;
  }

  return {
    request,
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, anonymous = false) =>
      request<T>('POST', path, { body: body ?? {}, anonymous }),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
    del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  };
}
