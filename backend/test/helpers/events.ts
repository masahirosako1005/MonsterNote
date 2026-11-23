// 試験用の API Gateway（HTTP API）と EventBridge のイベントを作る
import type { APIGatewayProxyEventV2WithJWTAuthorizer, EventBridgeEvent } from 'aws-lambda';

export interface ApiEventOptions {
  routeKey?: string;
  claims?: Record<string, string> | undefined;
  body?: unknown;
  rawBody?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  requestId?: string;
}

/** HTTP API の JWT オーソライザーを通ったイベントの形を作る */
export function apiEvent(options: ApiEventOptions = {}): APIGatewayProxyEventV2WithJWTAuthorizer {
  const routeKey = options.routeKey ?? 'GET /v1/test';
  const [method, path] = routeKey.split(' ');
  const body =
    options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  const hasClaims = 'claims' in options ? options.claims !== undefined : true;
  const claims =
    'claims' in options ? options.claims : { sub: 'hunter-a', 'cognito:groups': '[hunter]' };
  return {
    version: '2.0',
    routeKey,
    rawPath: path ?? '/',
    rawQueryString: '',
    headers: {},
    body,
    isBase64Encoded: false,
    pathParameters: options.pathParameters,
    queryStringParameters: options.queryStringParameters,
    requestContext: {
      accountId: '000000000000',
      apiId: 'api',
      domainName: 'api.test',
      domainPrefix: 'api',
      http: {
        method: method ?? 'GET',
        path: path ?? '/',
        protocol: 'HTTP/1.1',
        sourceIp: '0.0.0.0',
        userAgent: 'test',
      },
      requestId: options.requestId ?? 'req-1',
      routeKey,
      stage: '$default',
      time: '',
      timeEpoch: 0,
      authorizer: hasClaims
        ? { principalId: '', integrationLatency: 0, jwt: { claims: claims ?? {}, scopes: [] } }
        : (undefined as never),
    },
  } as APIGatewayProxyEventV2WithJWTAuthorizer;
}

/** EventBridge から受け手の関数に届くイベントの形を作る */
export function busEvent<T = never>(
  detailType: string,
  detail: unknown,
): EventBridgeEvent<string, T> {
  return {
    version: '0',
    id: 'bus-event-1',
    'detail-type': detailType,
    source: 'monsternote.test',
    account: '000000000000',
    time: '2026-11-23T00:00:00Z',
    region: 'ap-northeast-1',
    resources: [],
    detail: detail as T,
  };
}

/** 役割ごとの claims */
export const hunterClaims = (sub = 'hunter-a') => ({
  sub,
  'cognito:groups': '[hunter]',
  name: `表示名-${sub}`,
});
export const requesterClaims = (sub = 'requester-a') => ({
  sub,
  'cognito:groups': '[requester]',
  name: `表示名-${sub}`,
});
