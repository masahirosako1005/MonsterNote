// 共通のロガー（構造化した JSON。observability-design）。
// 出してよい項目の一覧（allowlist）にある項目だけを出し、氏名・位置・従事者番号・トークン・URL は出さない（NFR5.5）。

export const ALLOWED_LOG_FIELDS = [
  'requestId',
  'eventId',
  'route',
  'status',
  'durationMs',
  'errorCode',
  'accountId',
  'reportId',
  'attempt',
] as const;

export type LogField = (typeof ALLOWED_LOG_FIELDS)[number];
export type LogFields = Partial<Record<LogField, string | number | boolean>>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

type Level = 'info' | 'warn' | 'error';

function pickAllowed(fields: Record<string, unknown>): Record<string, string | number | boolean> {
  const picked: Record<string, string | number | boolean> = {};
  for (const key of ALLOWED_LOG_FIELDS) {
    const value = fields[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      picked[key] = value;
    }
  }
  return picked;
}

export function createLogger(
  functionName: string,
  sink: (line: string) => void = (line) => console.log(line),
  now: () => Date = () => new Date(),
): Logger {
  const write = (level: Level, message: string, fields: LogFields = {}) => {
    sink(
      JSON.stringify({
        timestamp: now().toISOString(),
        level,
        function: functionName,
        message,
        ...pickAllowed(fields as Record<string, unknown>),
      }),
    );
  };
  return {
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
