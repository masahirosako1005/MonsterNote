// スモーク（npm run smoke）: dev にデプロイしたあと、細い版を端から端まで確かめる（cicd-pipeline の段階 6）。
// infra/.env.local から URL と試験用のアカウントを読む。負荷はかけない（数十リクエスト程度。project.md の Forbidden）。
// 手順: ① 画面と config.json ② ハンターのログイン ③ 写真の受け付け → S3 へ POST → complete ④ 報告の送信
//       ⑤ ハンターの一覧に 10 秒以内に「確認中」 ⑥ 依頼元のログイン・一覧・承認 ⑦ ハンターの一覧が 10 秒以内に「承認」
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENV_PATH = fileURLToPath(new URL('../infra/.env.local', import.meta.url));
const REQUIRED = [
  'HUNTER_URL',
  'REQUESTER_URL',
  'API_URL',
  'SMOKE_HUNTER_LOGIN_ID',
  'SMOKE_HUNTER_PASSWORD',
  'SMOKE_REQUESTER_LOGIN_ID',
  'SMOKE_REQUESTER_PASSWORD',
] as const;
type SmokeEnv = Record<(typeof REQUIRED)[number], string>;

// 小さな JPEG（1x1）
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return values;
}

function loadEnv(): SmokeEnv {
  if (!existsSync(ENV_PATH))
    throw new Error(
      `${ENV_PATH} がありません（infra/.env.local.example を写して値を入れてください）`,
    );
  const values = parseEnvFile(readFileSync(ENV_PATH, 'utf8'));
  const missing = REQUIRED.filter((key) => !values[key]);
  if (missing.length > 0)
    throw new Error(`infra/.env.local に値がありません: ${missing.join(', ')}`);
  return values as SmokeEnv;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function step(n: number, title: string, run: () => Promise<void>) {
  const started = Date.now();
  try {
    await run();
    console.log(`✔ ${n}. ${title}（${Date.now() - started} ms）`);
  } catch (err) {
    console.error(`✘ ${n}. ${title}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function api<T>(
  base: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status} ${text}（問い合わせ番号: ${res.headers.get('x-request-id') ?? '-'}）`,
    );
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

async function waitForStatus(env: SmokeEnv, token: string, reportId: string, status: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const page = await api<{ items: { reportId: string; status: string }[] }>(
      env.API_URL,
      'GET',
      '/v1/catalog/my-reports',
      token,
    );
    if (page.items.some((r) => r.reportId === reportId && r.status === status)) return;
    await sleep(1_000);
  }
  throw new Error(`10 秒以内に一覧が「${status}」になりませんでした`);
}

async function uploadPhoto(env: SmokeEnv, hunterToken: string, kind: 'body' | 'tail') {
  const ticket = await api<{
    photoId: string;
    uploadUrl: string;
    uploadFields: Record<string, string>;
  }>(env.API_URL, 'POST', '/v1/photos', hunterToken, {
    kind,
    contentType: 'image/jpeg',
    sizeBytes: JPEG.length,
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.uploadFields)) form.append(k, v);
  form.append('file', new Blob([JPEG], { type: 'image/jpeg' }));
  const upload = await fetch(ticket.uploadUrl, {
    method: 'POST',
    body: form,
    headers: { origin: env.HUNTER_URL.replace(/\/+$/, '') },
  });
  if (!upload.ok) throw new Error(`S3 への POST → ${upload.status} ${await upload.text()}`);
  if (!upload.headers.get('access-control-allow-origin')) {
    throw new Error('S3 の応答に CORS のヘッダーがありません');
  }
  await api(env.API_URL, 'POST', `/v1/photos/${ticket.photoId}/complete`, hunterToken);
  return ticket.photoId;
}

async function main() {
  const env = loadEnv();
  let hunterToken = '';
  let requesterToken = '';
  let photoId = '';
  let tailPhotoId = '';
  let reportId = '';

  await step(1, '2 つの画面と config.json が開ける', async () => {
    for (const url of [env.HUNTER_URL, env.REQUESTER_URL]) {
      const page = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!page.ok) throw new Error(`${url} → ${page.status}`);
      const config = (await (await fetch(`${url.replace(/\/+$/, '')}/config.json`)).json()) as {
        apiBaseUrl?: string;
      };
      if (config.apiBaseUrl?.replace(/\/+$/, '') !== env.API_URL.replace(/\/+$/, '')) {
        throw new Error(`${url}/config.json の apiBaseUrl が API_URL と違います`);
      }
    }
  });

  await step(2, '試験用のハンターでログインできる', async () => {
    const res = await api<{ idToken: string }>(env.API_URL, 'POST', '/v1/session', undefined, {
      loginId: env.SMOKE_HUNTER_LOGIN_ID,
      password: env.SMOKE_HUNTER_PASSWORD,
    });
    hunterToken = res.idToken;
  });

  await step(
    3,
    '写真（全身・尻尾）を受け付け、S3 に署名付きの POST で送り、完了を知らせる（CORS を含む）',
    async () => {
      photoId = await uploadPhoto(env, hunterToken, 'body');
      tailPhotoId = await uploadPhoto(env, hunterToken, 'tail');
    },
  );

  await step(4, '報告を送れる', async () => {
    const res = await api<{ reportId: string }>(env.API_URL, 'POST', '/v1/reports', hunterToken, {
      submissionKey: `smoke-${randomUUID()}`,
      photos: { body: photoId, tail: tailPhotoId },
      // 同じ場所・種類・時期だと重複の疑い（409）になるため、毎回わずかにずらす
      // （duplicateDistanceMeters の既定よりずっと大きい約0.05度≈5.5kmのジッター。perf-check.ts と同じ修正）
      location: {
        lat: 35.0 + (Math.random() - 0.5) * 0.1,
        lng: 135.0 + (Math.random() - 0.5) * 0.1,
      },
      locationSource: 'manual',
      capturedAt: new Date().toISOString(),
      capturedAtSource: 'manual',
      species: 'deer',
      sex: 'unknown',
      ageClass: 'adult',
      captureMethod: 'trap',
    });
    reportId = res.reportId;
  });

  await step(5, 'ハンターの一覧に 10 秒以内に「確認中」で出る（EventBridge の配達）', () =>
    waitForStatus(env, hunterToken, reportId, 'checking'),
  );

  await step(6, '依頼元でログインし、一覧に出た報告を承認できる', async () => {
    const res = await api<{ idToken: string }>(env.API_URL, 'POST', '/v1/session', undefined, {
      loginId: env.SMOKE_REQUESTER_LOGIN_ID,
      password: env.SMOKE_REQUESTER_PASSWORD,
    });
    requesterToken = res.idToken;
    const deadline = Date.now() + 10_000;
    for (;;) {
      const page = await api<{ items: { reportId: string }[] }>(
        env.API_URL,
        'GET',
        '/v1/catalog/reports',
        requesterToken,
      );
      if (page.items.some((r) => r.reportId === reportId)) break;
      if (Date.now() > deadline) throw new Error('依頼元の一覧に報告が出ません');
      await sleep(1_000);
    }
    // 確認の記録が届くまで少し待つことがある（404 REVIEW_NOT_READY）
    for (let i = 0; ; i++) {
      try {
        await api(env.API_URL, 'PUT', `/v1/reviews/${reportId}/decision`, requesterToken, {
          decision: 'approved',
        });
        break;
      } catch (err) {
        if (i >= 5 || !String(err).includes('REVIEW_NOT_READY')) throw err;
        await sleep(1_000);
      }
    }
  });

  await step(7, 'ハンターの一覧が 10 秒以内に「承認」になる', () =>
    waitForStatus(env, hunterToken, reportId, 'approved'),
  );

  console.log('スモークはすべて通りました');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(() => process.exit(1));
}
