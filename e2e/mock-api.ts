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
  status: 'checking' | 'approved';
  decidedByName?: string;
  decidedAt?: string;
}

let reports: Report[] = [];

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
    duplicateSuspected: false,
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
    const photoId = randomUUID();
    return send(res, 201, {
      photoId,
      uploadUrl: `${BASE}/__upload`,
      uploadFields: { key: `photos/${me.accountId}/${photoId}`, 'Content-Type': 'image/jpeg' },
      expiresInSeconds: 300,
    });
  }
  const complete = path.match(/^\/v1\/photos\/([^/]+)\/complete$/);
  if (method === 'POST' && complete) {
    return send(res, 200, { photoId: complete[1], uploadStatus: 'uploaded' });
  }

  if (method === 'POST' && path === '/v1/reports') {
    if (me.role !== 'hunter') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const body = await readJson(req);
    const existing = reports.find((r) => r.submissionKey === body.submissionKey);
    if (existing) return send(res, 200, { reportId: existing.reportId });
    const report: Report = {
      reportId: randomUUID(),
      hunterAccountId: me.accountId,
      hunterName: me.displayName,
      species: String(body.species),
      sex: String(body.sex),
      location: body.location as { lat: number; lng: number },
      submittedAt: new Date().toISOString(),
      photoId: String((body.photos as { body?: string } | undefined)?.body),
      submissionKey: String(body.submissionKey),
      status: 'checking',
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
    return send(res, 200, {
      items: reports.map(listItem),
      nextCursor: null,
      totalCount: reports.length,
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
      capturedAtSource: 'device',
      location: r.location,
      locationSource: 'device',
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
      r.status = 'approved';
      r.decidedByName = me.displayName;
      r.decidedAt = new Date().toISOString();
      return send(res, 200, {
        ...view,
        status: r.status,
        decidedByName: r.decidedByName,
        decidedAt: r.decidedAt,
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
