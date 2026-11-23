// 共通のエラーの形（contract-summary 2.2）。code は機械が読む種類、message は利用者に見せてよい日本語。

export interface ErrorDetail {
  field: string;
  reason: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: ErrorDetail[];
  conflict?: Record<string, unknown>;
}

/** API の応答に変換される業務のエラー */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
    readonly conflict?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toBody(): ErrorBody {
    const body: ErrorBody = { code: this.code, message: this.message };
    if (this.details && this.details.length > 0) body.details = this.details;
    if (this.conflict) body.conflict = this.conflict;
    return body;
  }
}

export const errors = {
  validation: (details: ErrorDetail[], message = '入力に誤りがあります') =>
    new AppError(400, 'VALIDATION_FAILED', message, details),
  unauthenticated: (message = 'ログインしてください') =>
    new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'この操作はできません') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = '見つかりません', code = 'NOT_FOUND') => new AppError(404, code, message),
  conflict: (code: string, message: string, conflict: Record<string, unknown>) =>
    new AppError(409, code, message, undefined, conflict),
  unprocessable: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(422, code, message, details),
  internal: (message = 'サーバーで問題が起きました。もう一度お試しください') =>
    new AppError(500, 'INTERNAL_ERROR', message),
};

/** どんな例外も AppError にする（知らない例外は 500） */
export function toAppError(err: unknown): AppError {
  return err instanceof AppError ? err : errors.internal();
}
