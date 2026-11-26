// 仮のパスワードのままでは、パスワードの変更以外は何もできない（BR11.4、security-design.md §1）。
// API Gatewayの認可（JWTの役割）とは別の、アプリ層の確認。各関数の共通の入口（createHttpHandler）1箇所にまとめる。
export const PASSWORD_GATE_EXEMPT_ROUTES: ReadonlySet<string> = new Set([
  'PUT /v1/me/password',
  'GET /v1/me',
]);

export function isPasswordGateExempt(routeKey: string): boolean {
  return PASSWORD_GATE_EXEMPT_ROUTES.has(routeKey);
}
