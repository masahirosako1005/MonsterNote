// E2E 用の API のモックのサーバー（AWS を使わない。team.md の E2E）。
// 約束（contract-summary C1〜C4）の形で応答し、データはメモリに持つ。POST /__reset で空に戻す。
// 起動: npx tsx e2e/mock-api.ts（Playwright の webServer が起動する）
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.MOCK_API_PORT ?? 4610);
const BASE = `http://localhost:${PORT}`;

interface Account {
  accountId: string;
  loginId: string;
  password: string;
  role: 'hunter' | 'requester';
  displayName: string;
}

const ACCOUNTS: Account[] = [
  {
    accountId: 'hunter-a',
    loginId: 'hunter01',
    password: 'pass1234',
    role: 'hunter',
    displayName: 'ハンター A',
  },
  {
    accountId: 'hunter-b',
    loginId: 'hunter02',
    password: 'pass1234',
    role: 'hunter',
    displayName: 'ハンター B',
  },
  {
    accountId: 'requester-a',
    loginId: 'city01',
    password: 'pass1234',
    role: 'requester',
    displayName: '市の担当',
  },
];

interface Report {
  reportId: string;
  hunterAccountId: string;
  hunterName: string;
  species: string;
  sex: string;
  location: { lat: number; lng: number };
  submittedAt: string;
  photoId: string;
  submissionKey: string;
  status: 'checking' | 'approved' | 'rejected';
  decidedByName?: string;
  decidedAt?: string;
  // U3（新規）
  reason?: string;
  reasonText?: string;
  undoUntil?: string;
  duplicateSuspected?: boolean;
}

// U3（BR3.9・BR3.15）: 取り消しができる期間。本物の値（backend/src/review/decision.ts の
// UNDO_WINDOW_MS）と同じ 10 秒に合わせる（E2E は却下の直後に取り消すだけなので余裕がある）
const UNDO_WINDOW_MS = 10_000;

let reports: Report[] = [];
// U2: 写真ごとの kind（判別は全身の写真だけ。BR6.2）
const photoKinds = new Map<string, string>();
// U2: 次の全身の写真の判別の結果（試験が POST /__set-detection で切り替える。既定は「判別できた」）
let nextDetectionOutcome: 'detected' | 'undetected' = 'detected';

// 1x1 の PNG（写真の表示用）
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'x-request-id': randomUUID(),
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

const error = (
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  conflict?: unknown,
) => send(res, status, { code, message, ...(conflict ? { conflict } : {}) });

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function caller(req: IncomingMessage): Account | undefined {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  return ACCOUNTS.find((a) => token === `token-${a.accountId}`);
}

function tokens(account: Account) {
  return {
    idToken: `token-${account.accountId}`,
    accessToken: `access-${account.accountId}`,
    refreshToken: `refresh-${account.accountId}`,
    expiresIn: 3600,
    account: { accountId: account.accountId, role: account.role, displayName: account.displayName },
  };
}

function listItem(r: Report) {
  return {
    reportId: r.reportId,
    hunterName: r.hunterName,
    species: r.species,
    capturedAt: r.submittedAt,
    placeName: null,
    status: r.status,
    duplicateSuspected: r.duplicateSuspected ?? false,
    manualEntry: false,
    submittedAt: r.submittedAt,
  };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', BASE);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') return send(res, 204);
  if (method === 'POST' && path === '/__reset') {
    reports = [];
    photoKinds.clear();
    nextDetectionOutcome = 'detected';
    return send(res, 204);
  }
  if (method === 'POST' && path === '/__set-detection') {
    const body = await readJson(req);
    nextDetectionOutcome = body.outcome === 'undetected' ? 'undetected' : 'detected';
    return send(res, 204);
  }
  if (method === 'POST' && path === '/__upload') {
    await readJson(req).catch(() => undefined);
    return send(res, 204);
  }
  if (method === 'GET' && path.startsWith('/__photo/')) {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(PNG);
  }

  if (method === 'POST' && path === '/v1/session') {
    const body = await readJson(req);
    const account = ACCOUNTS.find(
      (a) => a.loginId === body.loginId && a.password === body.password,
    );
    if (!account) return error(res, 401, 'UNAUTHENTICATED', 'ID かパスワードが違います');
    return send(res, 200, {
      ...tokens(account),
      mustChangePassword: false,
      consentRequired: false,
      hunterNumberRequired: false,
    });
  }
  if (method === 'POST' && path === '/v1/session/refresh') {
    const body = await readJson(req);
    const account = ACCOUNTS.find((a) => body.refreshToken === `refresh-${a.accountId}`);
    if (!account) return error(res, 401, 'UNAUTHENTICATED', 'もう一度ログインしてください');
    return send(res, 200, tokens(account));
  }

  const me = caller(req);
  if (!me) return error(res, 401, 'UNAUTHENTICATED', 'ログインしてください');

  if (method === 'DELETE' && path === '/v1/session') return send(res, 204);

  if (method === 'POST' && path === '/v1/photos') {
    if (me.role !== 'hunter') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const body = await readJson(req);
    const photoId = randomUUID();
    photoKinds.set(photoId, String(body.kind ?? 'body'));
    return send(res, 201, {
      photoId,
      uploadUrl: `${BASE}/__upload`,
      uploadFields: { key: `photos/${me.accountId}/${photoId}`, 'Content-Type': 'image/jpeg' },
      expiresInSeconds: 300,
    });
  }
  const complete = path.match(/^\/v1\/photos\/([^/]+)\/complete$/);
  if (method === 'POST' && complete) {
    const photoId = complete[1] ?? '';
    // U2: 全身の写真（kind=body）は種類の判別の結果を返す（BR6.2〜BR6.4）
    const detection =
      photoKinds.get(photoId) === 'body'
        ? nextDetectionOutcome === 'undetected'
          ? { outcome: 'undetected' }
          : { outcome: 'detected', species: 'boar', confidence: 92 }
        : undefined;
    return send(res, 200, {
      photoId,
      uploadStatus: 'uploaded',
      ...(detection ? { detection } : {}),
    });
  }

  if (method === 'GET' && path === '/v1/report-settings') {
    // U2（新規。ADR-010）: 日本のおおよその範囲（初期値。BR9.3）
    return send(res, 200, {
      targetArea: { north: 46, south: 20, east: 154, west: 122 },
    });
  }

  if (method === 'POST' && path === '/v1/reports') {
    if (me.role !== 'hunter') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const body = await readJson(req);
    const submissionKey = String(body.submissionKey);
    const existing = reports.find((r) => r.submissionKey === submissionKey);
    if (existing) return send(res, 200, { reportId: existing.reportId });
    // U2（BR7.1・BR7.2）: すでに同じ種類の報告があり、まだ確認していなければ疑いを返す
    // （1 件目の報告は必ず通るため、既存の U1 の試験の流れは変えない）
    const sameSpecies = reports.find((r) => r.species === body.species);
    if (sameSpecies && body.confirmedNotDuplicate !== true) {
      return error(res, 409, 'DUPLICATE_SUSPECTED', '近くで同じ種類・時期の報告があります', {
        matches: [
          {
            species: String(body.species),
            capturedAt: sameSpecies.submittedAt,
            distanceMeters: 300,
          },
        ],
      });
    }
    const report: Report = {
      reportId: randomUUID(),
      hunterAccountId: me.accountId,
      hunterName: me.displayName,
      species: String(body.species),
      sex: String(body.sex),
      location: body.location as { lat: number; lng: number },
      submittedAt: new Date().toISOString(),
      photoId: String((body.photos as { body?: string } | undefined)?.body),
      submissionKey,
      status: 'checking',
      // U3（一覧の絞り込みの印。BR7.1・BR7.2）: 重複の確認を経て送ったものに印を付ける
      duplicateSuspected: body.confirmedNotDuplicate === true,
    };
    reports.unshift(report);
    return send(res, 201, { reportId: report.reportId });
  }

  if (method === 'GET' && path === '/v1/catalog/my-reports') {
    if (me.role !== 'hunter') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const mine = reports.filter((r) => r.hunterAccountId === me.accountId);
    return send(res, 200, { items: mine.map(listItem), nextCursor: null, totalCount: mine.length });
  }
  if (method === 'GET' && path === '/v1/catalog/reports') {
    if (me.role !== 'requester') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    // U3（BR4.5）: status・flag で絞り込む（複数はカンマ区切り）
    const statusFilter = url.searchParams.get('status')?.split(',').filter(Boolean) ?? [];
    const flagFilter = url.searchParams.get('flag')?.split(',').filter(Boolean) ?? [];
    const filtered = reports.filter((r) => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      if (flagFilter.length > 0) {
        const hasFlag =
          (flagFilter.includes('duplicate') && r.duplicateSuspected) ||
          (flagFilter.includes('manual') && false);
        if (!hasFlag) return false;
      }
      return true;
    });
    return send(res, 200, {
      items: filtered.map(listItem),
      nextCursor: null,
      totalCount: filtered.length,
    });
  }

  const reportMatch = path.match(/^\/v1\/reports\/([^/]+)$/);
  if (method === 'GET' && reportMatch) {
    const r = reports.find((x) => x.reportId === reportMatch[1]);
    if (!r) return error(res, 404, 'NOT_FOUND', '報告が見つかりません');
    if (me.role === 'hunter' && r.hunterAccountId !== me.accountId) {
      return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    }
    return send(res, 200, {
      reportId: r.reportId,
      hunterAccountId: r.hunterAccountId,
      hunterNumber: '123',
      species: r.species,
      sex: r.sex,
      capturedAt: r.submittedAt,
      capturedAtSource: 'exif',
      location: r.location,
      locationSource: 'exif',
      ageClass: 'adult',
      captureMethod: 'trap',
      submittedAt: r.submittedAt,
      photos: [
        {
          photoId: r.photoId,
          kind: 'body',
          url: `${BASE}/__photo/${r.photoId}`,
          expiresInSeconds: 900,
        },
      ],
    });
  }

  // U2（新規。C5）: 重複の疑いの相手の一覧。この E2E のモックでは常に空（重複の試験は別の経路で確かめる）
  const duplicatesMatch = path.match(/^\/v1\/duplicates\/([^/]+)$/);
  if (method === 'GET' && duplicatesMatch) {
    if (me.role !== 'requester') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    return send(res, 200, { reportId: duplicatesMatch[1], matches: [] });
  }

  // U3（BR3.9・BR3.15）: 取り消し。decision の道より先に見る（/decision/undo が /decision にもマッチしてしまわないように）
  const undoMatch = path.match(/^\/v1\/reviews\/([^/]+)\/decision\/undo$/);
  if (method === 'POST' && undoMatch) {
    if (me.role !== 'requester') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const r = reports.find((x) => x.reportId === undoMatch[1]);
    if (!r) return error(res, 404, 'NOT_FOUND', '報告が見つかりません');
    if (r.status === 'checking')
      return error(res, 409, 'ALREADY_UNDONE', 'すでに確認中に戻っています');
    if (!r.undoUntil || new Date(r.undoUntil).getTime() < Date.now()) {
      return error(res, 409, 'UNDO_EXPIRED', '取り消せる期限が過ぎています');
    }
    r.status = 'checking';
    r.decidedByName = undefined;
    r.decidedAt = undefined;
    r.reason = undefined;
    r.reasonText = undefined;
    r.undoUntil = undefined;
    return send(res, 204);
  }

  const reviewMatch = path.match(/^\/v1\/reviews\/([^/]+)(\/decision)?$/);
  if (reviewMatch) {
    const r = reports.find((x) => x.reportId === reviewMatch[1]);
    if (!r)
      return error(
        res,
        404,
        'REVIEW_NOT_READY',
        'まだ確認の準備ができていません。少し待ってからもう一度押してください',
      );
    const view = {
      reportId: r.reportId,
      status: r.status,
      decidedByName: r.decidedByName,
      decidedAt: r.decidedAt,
      reason: r.reason,
      reasonText: r.reasonText,
      // 本人かつ期限内のときだけ返る（BR3.15）
      undoUntil: me.role === 'requester' && r.undoUntil ? r.undoUntil : undefined,
    };
    if (method === 'GET' && !reviewMatch[2]) return send(res, 200, view);
    if (method === 'PUT' && reviewMatch[2]) {
      if (me.role !== 'requester') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
      if (r.status !== 'checking') {
        return error(res, 409, 'ALREADY_DECIDED', 'すでに確認済みです', {
          decision: r.status,
          decidedByName: r.decidedByName,
          decidedAt: r.decidedAt,
        });
      }
      const body = await readJson(req);
      const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
      r.status = decision;
      r.decidedByName = me.displayName;
      r.decidedAt = new Date().toISOString();
      if (decision === 'rejected') {
        r.reason = typeof body.reason === 'string' ? body.reason : undefined;
        r.reasonText = typeof body.reasonText === 'string' ? body.reasonText : undefined;
        r.undoUntil = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();
      }
      return send(res, 200, {
        ...view,
        status: r.status,
        decidedByName: r.decidedByName,
        decidedAt: r.decidedAt,
        reason: r.reason,
        reasonText: r.reasonText,
        undoUntil: r.undoUntil,
      });
    }
  }

  return error(res, 404, 'NOT_FOUND', '見つかりません');
}

createServer((req, res) => {
  // 2 つの画面（別の Origin）から呼ぶため CORS を許す（本物は HTTP API の CORS の設定）
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('access-control-expose-headers', 'x-request-id');
  handle(req, res).catch((err: unknown) => {
    console.error(err);
    error(res, 500, 'INTERNAL_ERROR', 'サーバーで問題が起きました');
  });
}).listen(PORT, () => console.log(`mock API: ${BASE}`));
