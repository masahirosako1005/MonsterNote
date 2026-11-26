// 性能の実測（npm run perf:check）: dev にデプロイ済みの本物の API に、軽い・一度きりの呼び出し（約48件、
// 並行度1）を行い、NFR2.x（応答時間）の目標とおおよそ合っているかを確かめる（performance-validation ステージ）。
// これは負荷試験ではない（project.md Forbidden「NEVER run load tests that could exceed the Free Tier」、
// team.md「数十リクエスト程度の確認にとどめる」）。実行は人の承認を得てから行う。
// 詳細: operation/performance-validation/load-test-plan.md
//
// 前提: infra/.env.local に SMOKE_ADMIN_LOGIN_ID・SMOKE_ADMIN_PASSWORD が要る（load-test-plan.md §3b）。
// まだ無ければ先に: npm run account:create -- --role admin --login-id <...> --display-name <...>
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
  'SMOKE_ADMIN_LOGIN_ID',
  'SMOKE_ADMIN_PASSWORD',
] as const;
type PerfEnv = Record<(typeof REQUIRED)[number], string>;

// 小さな JPEG（1x1。scripts/smoke.ts と同じ）
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

function parseEnvFile(text: string): Record<string, string> {
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

function loadEnv(): PerfEnv {
  if (!existsSync(ENV_PATH)) throw new Error(`${ENV_PATH} がありません`);
  const values = parseEnvFile(readFileSync(ENV_PATH, 'utf8'));
  const missing = REQUIRED.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(
      `infra/.env.local に値がありません: ${missing.join(', ')}（load-test-plan.md §3b 参照。` +
        `管理者の試験用アカウントが無ければ先に npm run account:create -- --role admin ... で作る）`,
    );
  }
  return values as PerfEnv;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Sample {
  label: string;
  nfr: string;
  ms: number;
}
const samples: Sample[] = [];

async function timed<T>(label: string, nfr: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await run();
  samples.push({ label, nfr, ms: Date.now() - started });
  return result;
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
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status} ${text}（問い合わせ番号: ${res.headers.get('x-request-id') ?? '-'}）`,
    );
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

async function uploadPhoto(env: PerfEnv, hunterToken: string, kind: 'body' | 'tail') {
  const ticket = await timed('POST /v1/photos', 'NFR2.6', () =>
    api<{ photoId: string; uploadUrl: string; uploadFields: Record<string, string> }>(
      env.API_URL,
      'POST',
      '/v1/photos',
      hunterToken,
      { kind, contentType: 'image/jpeg', sizeBytes: JPEG.length },
    ),
  );
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.uploadFields)) form.append(k, v);
  form.append('file', new Blob([JPEG], { type: 'image/jpeg' }));
  const upload = await fetch(ticket.uploadUrl, {
    method: 'POST',
    body: form,
    headers: { origin: env.HUNTER_URL.replace(/\/+$/, '') },
  });
  if (!upload.ok) throw new Error(`S3 への POST → ${upload.status} ${await upload.text()}`);
  await timed('POST /v1/photos/{id}/complete（全身）', 'NFR2.7', () =>
    api(env.API_URL, 'POST', `/v1/photos/${ticket.photoId}/complete`, hunterToken),
  );
  return ticket.photoId;
}

async function submitOneReport(env: PerfEnv, hunterToken: string): Promise<string> {
  const photoId = await uploadPhoto(env, hunterToken, 'body');
  const tailPhotoId = await uploadPhoto(env, hunterToken, 'tail');
  const { reportId } = await timed('POST /v1/reports', 'NFR2.2', () =>
    api<{ reportId: string }>(env.API_URL, 'POST', '/v1/reports', hunterToken, {
      submissionKey: `perf-${randomUUID()}`,
      photos: { body: photoId, tail: tailPhotoId },
      // 同じ場所・種類・時期だと重複の疑い（409）になるため、毎回わずかにずらす
      // （duplicateDistanceMeters の既定よりずっと大きい約0.05度≈5.5kmのジッター）
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
    }),
  );
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const page = await timed('GET /v1/catalog/my-reports（確認中待ち）', 'NFR2.10（間接）', () =>
      api<{ items: { reportId: string; status: string }[] }>(
        env.API_URL,
        'GET',
        '/v1/catalog/my-reports',
        hunterToken,
      ),
    );
    if (page.items.some((r) => r.reportId === reportId && r.status === 'checking')) break;
    await sleep(1_000);
  }
  return reportId;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

function printSummary() {
  const byNfr = new Map<string, number[]>();
  for (const s of samples) {
    (byNfr.get(s.nfr) ?? byNfr.set(s.nfr, []).get(s.nfr)!).push(s.ms);
  }
  console.log('\n--- NFR 別の応答時間（ms） ---');
  for (const [nfr, values] of byNfr) {
    console.log(
      `${nfr}: n=${values.length} p50=${percentile(values, 50)} p95=${percentile(values, 95)} max=${Math.max(...values)}`,
    );
  }
  console.log(`\n合計リクエスト数（ポーリング含む）: ${samples.length}`);
}

async function main() {
  const env = loadEnv();

  const { idToken: hunterToken } = await timed('POST /v1/session（ハンター）', '—', () =>
    api<{ idToken: string }>(env.API_URL, 'POST', '/v1/session', undefined, {
      loginId: env.SMOKE_HUNTER_LOGIN_ID,
      password: env.SMOKE_HUNTER_PASSWORD,
    }),
  );
  const { idToken: requesterToken } = await timed('POST /v1/session（依頼元）', '—', () =>
    api<{ idToken: string }>(env.API_URL, 'POST', '/v1/session', undefined, {
      loginId: env.SMOKE_REQUESTER_LOGIN_ID,
      password: env.SMOKE_REQUESTER_PASSWORD,
    }),
  );
  const { idToken: adminToken } = await timed('POST /v1/session（管理者）', '—', () =>
    api<{ idToken: string }>(env.API_URL, 'POST', '/v1/session', undefined, {
      loginId: env.SMOKE_ADMIN_LOGIN_ID,
      password: env.SMOKE_ADMIN_PASSWORD,
    }),
  );

  // 3件の報告を送る（NFR2.2・NFR2.6・NFR2.7・NFR2.10（間接））
  const reportIds = [
    await submitOneReport(env, hunterToken),
    await submitOneReport(env, hunterToken),
    await submitOneReport(env, hunterToken),
  ];

  // 一覧・詳細（NFR2.1・NFR2.12）
  for (const query of ['', '?status=checking', '?status=approved,rejected']) {
    await timed(`GET /v1/catalog/reports${query}`, query ? 'NFR2.12' : 'NFR2.1', () =>
      api(env.API_URL, 'GET', `/v1/catalog/reports${query}`, requesterToken),
    );
  }
  for (const reportId of reportIds.slice(0, 2)) {
    await timed('GET /v1/reviews/{id}', 'NFR2.1', () =>
      api(env.API_URL, 'GET', `/v1/reviews/${reportId}`, requesterToken),
    );
  }

  // 承認2件・却下1件・取り消し1件（NFR2.3・NFR2.13・NFR2.14）
  for (const reportId of reportIds.slice(0, 2)) {
    await timed('PUT /v1/reviews/{id}/decision（approved）', 'NFR2.3', () =>
      api(env.API_URL, 'PUT', `/v1/reviews/${reportId}/decision`, requesterToken, {
        decision: 'approved',
      }),
    );
  }
  const rejectedId = reportIds[2]!;
  await timed('PUT /v1/reviews/{id}/decision（rejected）', 'NFR2.13', () =>
    api(env.API_URL, 'PUT', `/v1/reviews/${rejectedId}/decision`, requesterToken, {
      decision: 'rejected',
      reason: 'duplicate',
    }),
  );
  await timed('POST /v1/reviews/{id}/decision/undo', 'NFR2.14', () =>
    api(env.API_URL, 'POST', `/v1/reviews/${rejectedId}/decision/undo`, requesterToken),
  );

  // 管理者系（NFR2.15・NFR2.16・NFR2.17）。使い捨てアカウントは最後に無効化する
  for (let i = 0; i < 3; i++) {
    await timed('GET /v1/admin/accounts', 'NFR2.15', () =>
      api(env.API_URL, 'GET', '/v1/admin/accounts', adminToken),
    );
  }
  const tempLoginId = `perfchk${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const { accountId: tempAccountId } = await timed('POST /v1/admin/accounts', 'NFR2.16', () =>
    api<{ accountId: string }>(env.API_URL, 'POST', '/v1/admin/accounts', adminToken, {
      role: 'hunter',
      loginId: tempLoginId,
      displayName: '性能計測の使い捨てアカウント',
    }),
  );
  await timed('POST /v1/admin/accounts/{id}/password-reset', 'NFR2.16', () =>
    api(env.API_URL, 'POST', `/v1/admin/accounts/${tempAccountId}/password-reset`, adminToken),
  );
  await timed('PUT /v1/admin/accounts/{id}/status（後片付け・無効化）', '—', () =>
    api(env.API_URL, 'PUT', `/v1/admin/accounts/${tempAccountId}/status`, adminToken, {
      status: 'disabled',
    }),
  );
  for (let i = 0; i < 3; i++) {
    await timed('GET /v1/admin/audit-entries', 'NFR2.17', () =>
      api(env.API_URL, 'GET', '/v1/admin/audit-entries', adminToken),
    );
  }

  printSummary();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
