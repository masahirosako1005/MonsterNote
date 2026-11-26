// API Gateway（HTTP API）の応答とエラーの変換。すべての応答に requestId（問い合わせ番号）をヘッダーで付ける。
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { getCaller, type Caller } from './auth';
import { errors, toAppError } from './errors';
import type { Logger } from './logger';
import { isPasswordGateExempt } from './require-password-changed';

export type HttpEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type HttpResult = APIGatewayProxyStructuredResultV2;
export type RouteHandler = (event: HttpEvent) => Promise<HttpResult>;

export function json(status: number, body: unknown, requestId: string): HttpResult {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
    body: JSON.stringify(body),
  };
}

export function noContent(requestId: string): HttpResult {
  return { statusCode: 204, headers: { 'x-request-id': requestId } };
}

/** 本文を JSON の物として読む。壊れていれば 400 */
export function parseJsonBody(event: HttpEvent): Record<string, unknown> {
  if (!event.body) return {};
  const text = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw errors.validation([{ field: 'body', reason: 'invalid-json' }]);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw errors.validation([{ field: 'body', reason: 'not-an-object' }]);
  }
  return parsed as Record<string, unknown>;
}

export function requestIdOf(event: HttpEvent): string {
  return event.requestContext.requestId;
}

export interface HttpHandlerOptions {
  /**
   * 仮のパスワードのままなら true を返す（U4・BR11.4）。呼び出し元（accounts は直接、
   * ほかの関数は Accounts への内部の呼び出し）が実現する。証明があり、かつ
   * PASSWORD_GATE_EXEMPT_ROUTES に無い道だけで確かめる
   */
  passwordGate?: (caller: Caller) => Promise<boolean>;
}

/** routeKey（例 "POST /v1/reports"）で処理を選び、例外を共通のエラーの形にする */
export function createHttpHandler(
  routes: Record<string, RouteHandler>,
  logger: Logger,
  options: HttpHandlerOptions = {},
): (event: HttpEvent) => Promise<HttpResult> {
  return async (event) => {
    const requestId = requestIdOf(event);
    const route = event.routeKey;
    const started = Date.now();
    const handler = routes[route];
    try {
      if (!handler) throw errors.notFound();
      if (options.passwordGate && !isPasswordGateExempt(route)) {
        let caller: Caller | undefined;
        try {
          caller = getCaller(event);
        } catch {
          caller = undefined; // 証明がない道（ログインなど）はこの確認の対象外
        }
        if (caller && (await options.passwordGate(caller))) {
          throw errors.passwordChangeRequired();
        }
      }
      const result = await handler(event);
      logger.info('応答', {
        requestId,
        route,
        status: result.statusCode ?? 200,
        durationMs: Date.now() - started,
      });
      return result;
    } catch (err) {
      const appError = toAppError(err);
      const fields = {
        requestId,
        route,
        status: appError.status,
        errorCode: appError.code,
        durationMs: Date.now() - started,
      };
      if (appError.status >= 500) logger.error('処理の失敗', fields);
      else logger.info('業務のエラー', fields);
      return json(appError.status, appError.toBody(), requestId);
    }
  };
}
