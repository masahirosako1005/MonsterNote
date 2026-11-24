// 知らせの共通の処理（contract-summary 2.4 の EventEnvelope、reliability-design の送り方）。
// EventBridge への送信は 1 回 0.5 秒で時間切れ、最大 3 回まで 0.1・0.2 秒の間隔でやり直す。
// 3 回とも失敗したら EventPublishError を投げ、呼んだ側が 500 にする。
import { randomUUID } from 'node:crypto';
import { PutEventsCommand, type EventBridgeClient } from '@aws-sdk/client-eventbridge';

export type ComponentName =
  | 'Accounts'
  | 'Reporting'
  | 'SpeciesDetection'
  | 'DuplicateDetection'
  | 'Review'
  | 'ReportCatalog'
  | 'Settings';

export interface EventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  actorAccountId?: string;
  source: ComponentName;
  data: T;
}

/** report.saved の中身（C12。U1 で使う項目） */
export interface ReportSavedData {
  reportId: string;
  hunterAccountId: string;
  hunterName: string;
  species: 'bear' | 'boar' | 'deer';
  capturedAt: string;
  location: { lat: number; lng: number };
  placeName?: string;
  manualEntry: boolean;
  submittedAt: string;
  bodyPhotoId: string;
}

/** review.status-changed の中身（C13）。reason・undone は U3 で使う（却下の理由・取り消し） */
export interface ReviewStatusChangedData {
  reportId: string;
  status: 'checking' | 'approved' | 'rejected';
  previousStatus: 'none' | 'checking' | 'approved' | 'rejected';
  reason?: 'duplicate' | 'insufficient-photo' | 'out-of-scope' | 'other';
  undone?: boolean;
  changedAt: string;
}

/** duplicate.suspected の中身（C14。U2）。疑いの組ごとに reportId 側・matchedReportId 側で 2 つ送る */
export interface DuplicateSuspectedData {
  reportId: string;
  matchedReportId: string;
  kind: 'place-time' | 'photo' | 'moon-ring';
}

export class EventPublishError extends Error {
  constructor(
    readonly eventType: string,
    readonly attempts: number,
  ) {
    super(`知らせ ${eventType} を ${attempts} 回送れなかった`);
    this.name = 'EventPublishError';
  }
}

/** 部品の名前から EventBridge の source を作る（ルールはこの source で絞る） */
export function eventSourceOf(component: ComponentName): string {
  return `monsternote.${component.toLowerCase()}`;
}

export function createEnvelope<T>(input: {
  type: string;
  source: ComponentName;
  data: T;
  actorAccountId?: string;
  version?: number;
  now?: () => Date;
  newId?: () => string;
}): EventEnvelope<T> {
  const envelope: EventEnvelope<T> = {
    eventId: (input.newId ?? randomUUID)(),
    type: input.type,
    version: input.version ?? 1,
    occurredAt: (input.now ?? (() => new Date()))().toISOString(),
    source: input.source,
    data: input.data,
  };
  if (input.actorAccountId) envelope.actorAccountId = input.actorAccountId;
  return envelope;
}

export interface PublishOptions {
  /** やり直しの前に待つ時間（ミリ秒）。要素の数 + 1 が最大の回数 */
  delaysMs?: number[];
  attemptTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 決まった時間で打ち切る（時間切れは例外にし、呼び出しを中止する） */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void = () => undefined,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function publishEvent(
  client: EventBridgeClient,
  busName: string,
  envelope: EventEnvelope<unknown>,
  options: PublishOptions = {},
): Promise<void> {
  const delays = options.delaysMs ?? [100, 200];
  const timeoutMs = options.attemptTimeoutMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = delays.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const send = client.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: busName,
              Source: eventSourceOf(envelope.source),
              DetailType: envelope.type,
              Detail: JSON.stringify(envelope),
            },
          ],
        }),
        { abortSignal: controller.signal },
      );
      const result = await withTimeout(send, timeoutMs, () => controller.abort());
      if (!result.FailedEntryCount) return;
    } catch {
      // 失敗は次のやり直しで扱う（最後の失敗は下で EventPublishError にする）
    }
    const delay = delays[attempt - 1];
    if (delay !== undefined) await sleep(delay);
  }
  throw new EventPublishError(envelope.type, maxAttempts);
}
