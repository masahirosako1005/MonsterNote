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
  role: 'hunter' | 'requester' | 'admin';
  displayName: string;
  organization?: string;
  // U4（BR11.1〜BR11.9）
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  consentedAt?: string;
  hunterNumber?: string;
}

// U1〜U3 の既存の試験が初回の手続きなしで使えるよう、最初から手続き済みの状態で用意する
const INITIAL_ACCOUNTS: Account[] = [
  {
    accountId: 'hunter-a',
    loginId: 'hunter01',
    password: 'pass1234',
    role: 'hunter',
    displayName: 'ハンター A',
    status: 'active',
    mustChangePassword: false,
    consentedAt: '2026-01-01T00:00:00.000Z',
    hunterNumber: '101',
  },
  {
    accountId: 'hunter-b',
    loginId: 'hunter02',
    password: 'pass1234',
    role: 'hunter',
    displayName: 'ハンター B',
    status: 'active',
    mustChangePassword: false,
    consentedAt: '2026-01-01T00:00:00.000Z',
    hunterNumber: '102',
  },
  {
    accountId: 'requester-a',
    loginId: 'city01',
    password: 'pass1234',
    role: 'requester',
    displayName: '市の担当',
    organization: 'municipality',
    status: 'active',
    mustChangePassword: false,
  },
  // U4（新規）: 管理者アプリの試験用
  {
    accountId: 'admin-a',
    loginId: 'admin01',
    password: 'pass1234',
    role: 'admin',
    displayName: '管理者 A',
    status: 'active',
    mustChangePassword: false,
  },
  // U4（UC21）: 初回の手続きをまだ終えていない新規のハンター
  {
    accountId: 'hunter-new',
    loginId: 'hunter09',
    password: 'temp1234',
    role: 'hunter',
    displayName: 'ハンター 新人',
    status: 'active',
    mustChangePassword: true,
  },
];

let ACCOUNTS: Account[] = INITIAL_ACCOUNTS.map((a) => ({ ...a }));

interface AuditEntry {
  entryId: string;
  occurredAt: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'succeeded' | 'failed';
  detail?: Record<string, unknown>;
}

let auditEntries: AuditEntry[] = [];

function recordAudit(
  actor: Account | undefined,
  action: string,
  targetType: string,
  targetId?: string,
  detail?: Record<string, unknown>,
) {
  auditEntries.unshift({
    entryId: randomUUID(),
    occurredAt: new Date().toISOString(),
    actorName: actor?.displayName,
    action,
    targetType,
    targetId,
    outcome: 'succeeded',
    detail,
  });
}

interface AdminSettings {
  duplicateDistanceMeters: number;
  duplicateWindowHours: number;
  targetAreaNorth: number;
  targetAreaSouth: number;
  targetAreaEast: number;
  targetAreaWest: number;
  updatedByAccountId?: string;
  updatedAt?: string;
}

const INITIAL_SETTINGS: AdminSettings = {
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
};

let adminSettings: AdminSettings = { ...INITIAL_SETTINGS };

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
    ACCOUNTS = INITIAL_ACCOUNTS.map((a) => ({ ...a }));
    auditEntries = [];
    adminSettings = { ...INITIAL_SETTINGS };
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
    if (!account || account.status !== 'active') {
      return error(res, 401, 'UNAUTHENTICATED', 'ID かパスワードが違います');
    }
    const isHunter = account.role === 'hunter';
    return send(res, 200, {
      ...tokens(account),
      mustChangePassword: account.mustChangePassword,
      consentRequired: isHunter && !account.consentedAt,
      hunterNumberRequired: isHunter && !account.hunterNumber,
    });
  }
  if (method === 'POST' && path === '/v1/session/refresh') {
    const body = await readJson(req);
    const account = ACCOUNTS.find((a) => body.refreshToken === `refresh-${a.accountId}`);
    if (!account || account.status !== 'active') {
      return error(res, 401, 'UNAUTHENTICATED', 'もう一度ログインしてください');
    }
    return send(res, 200, tokens(account));
  }

  const me = caller(req);
  if (!me) return error(res, 401, 'UNAUTHENTICATED', 'ログインしてください');

  if (method === 'DELETE' && path === '/v1/session') return send(res, 204);

  // U4（BR11.7）: 初回の手続き
  if (method === 'GET' && path === '/v1/me') {
    const isHunter = me.role === 'hunter';
    return send(res, 200, {
      accountId: me.accountId,
      role: me.role,
      displayName: me.displayName,
      mustChangePassword: me.mustChangePassword,
      consentRequired: isHunter && !me.consentedAt,
      hunterNumberRequired: isHunter && !me.hunterNumber,
    });
  }
  if (method === 'PUT' && path === '/v1/me/password') {
    const body = await readJson(req);
    const password = String(body.password ?? '');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return error(res, 422, 'VALIDATION_FAILED', '8 文字以上で、英字と数字を含めてください');
    }
    me.password = password;
    me.mustChangePassword = false;
    return send(res, 204);
  }
  if (method === 'PUT' && path === '/v1/me/consent') {
    const body = await readJson(req);
    if (typeof body.consented !== 'boolean') {
      return error(res, 400, 'VALIDATION_FAILED', '選んでください');
    }
    if (body.consented) me.consentedAt = new Date().toISOString();
    return send(res, 204);
  }
  if (method === 'PUT' && path === '/v1/me/hunter-number') {
    const body = await readJson(req);
    const hunterNumber = String(body.hunterNumber ?? '');
    if (!/^[0-9]{1,20}$/.test(hunterNumber)) {
      return error(res, 400, 'VALIDATION_FAILED', '番号を入れてください');
    }
    me.hunterNumber = hunterNumber;
    return send(res, 204);
  }

  // U4（US6.1〜US6.3）: 管理者のアカウント管理
  if (path === '/v1/admin/accounts' && (method === 'GET' || method === 'POST')) {
    if (me.role !== 'admin') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    if (method === 'GET') {
      return send(res, 200, {
        items: ACCOUNTS.map((a) => ({
          accountId: a.accountId,
          loginId: a.loginId,
          displayName: a.displayName,
          role: a.role,
          status: a.status,
          ...(a.organization ? { organization: a.organization } : {}),
        })),
      });
    }
    const body = await readJson(req);
    const loginId = String(body.loginId ?? '');
    if (ACCOUNTS.some((a) => a.loginId === loginId)) {
      return error(res, 409, 'LOGIN_ID_TAKEN', 'この ID は使われています');
    }
    const role = (body.role === 'admin' || body.role === 'requester' ? body.role : 'hunter') as
      'hunter' | 'requester' | 'admin';
    const temporaryPassword = 'tempPass1';
    const created: Account = {
      accountId: randomUUID(),
      loginId,
      password: temporaryPassword,
      role,
      displayName: String(body.displayName ?? ''),
      organization: typeof body.organization === 'string' ? body.organization : undefined,
      status: 'active',
      mustChangePassword: true,
    };
    ACCOUNTS.push(created);
    recordAudit(me, 'account.created', 'account', created.accountId);
    return send(res, 200, { accountId: created.accountId, temporaryPassword });
  }
  const statusMatch = path.match(/^\/v1\/admin\/accounts\/([^/]+)\/status$/);
  if (method === 'PUT' && statusMatch) {
    if (me.role !== 'admin') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const target = ACCOUNTS.find((a) => a.accountId === statusMatch[1]);
    if (!target) return error(res, 404, 'NOT_FOUND', '見つかりません');
    const body = await readJson(req);
    const status = body.status === 'disabled' ? 'disabled' : 'active';
    if (status === 'disabled' && target.accountId === me.accountId) {
      return error(res, 422, 'CANNOT_DISABLE_SELF', 'この操作はできません（自分自身）');
    }
    if (status === 'disabled' && target.role === 'admin') {
      const activeAdmins = ACCOUNTS.filter(
        (a) => a.role === 'admin' && a.status === 'active',
      ).length;
      if (activeAdmins <= 1) {
        return error(res, 422, 'LAST_ADMIN', 'この操作はできません（最後の管理者）');
      }
    }
    target.status = status;
    recordAudit(
      me,
      status === 'disabled' ? 'account.disabled' : 'account.enabled',
      'account',
      target.accountId,
    );
    return send(res, 204);
  }
  const passwordResetMatch = path.match(/^\/v1\/admin\/accounts\/([^/]+)\/password-reset$/);
  if (method === 'POST' && passwordResetMatch) {
    if (me.role !== 'admin') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const target = ACCOUNTS.find((a) => a.accountId === passwordResetMatch[1]);
    if (!target) return error(res, 404, 'NOT_FOUND', '見つかりません');
    const temporaryPassword = 'tempPass2';
    target.password = temporaryPassword;
    target.mustChangePassword = true;
    recordAudit(me, 'account.password-reset', 'account', target.accountId);
    return send(res, 200, { accountId: target.accountId, temporaryPassword });
  }

  // U4（US6.4）: 重複の基準と対象地域
  if (path === '/v1/admin/settings' && (method === 'GET' || method === 'PUT')) {
    if (me.role !== 'admin') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    if (method === 'GET') return send(res, 200, adminSettings);
    const body = await readJson(req);
    adminSettings = {
      duplicateDistanceMeters: Number(body.duplicateDistanceMeters),
      duplicateWindowHours: Number(body.duplicateWindowHours),
      targetAreaNorth: Number(body.targetAreaNorth),
      targetAreaSouth: Number(body.targetAreaSouth),
      targetAreaEast: Number(body.targetAreaEast),
      targetAreaWest: Number(body.targetAreaWest),
      updatedByAccountId: me.accountId,
      updatedAt: new Date().toISOString(),
    };
    recordAudit(me, 'settings.updated', 'settings');
    return send(res, 204);
  }

  // U4（US6.6）: 操作の記録
  if (method === 'GET' && path === '/v1/admin/audit-entries') {
    if (me.role !== 'admin') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    return send(res, 200, { items: auditEntries.slice(0, 50), nextCursor: null });
  }

  // U4（US6.5・BR13.1）: 試験運用の終わりのデータ削除
  const deleteDataMatch = path.match(
    /^\/v1\/admin\/(catalog|review|duplicate|detection|reporting)-data$/,
  );
  if (method === 'POST' && deleteDataMatch) {
    if (me.role !== 'admin') return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    const component = deleteDataMatch[1];
    // このモックでは一覧・確認・判別の記録を reports の付随情報として扱っているため、
    // 件数はどの入口でも現在の reports.length（本物の件数の持ち主は report・photo だけ）。
    // 実際に消す（reports を空にする）のは順番の最後（⑤ reporting）だけ。何度呼んでも同じ結果（BR13.1）
    const deletedCount = reports.length;
    if (component === 'reporting') {
      reports = [];
      photoKinds.clear();
    }
    recordAudit(me, 'data.deleted', 'data', undefined, { componentName: component, deletedCount });
    return send(res, 200, { deletedCount });
  }

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
    // U2（Build and Testで発見。本物のバックエンドの必須項目を、このモックも確かめる）
    const missing: string[] = [];
    const photos = body.photos as { body?: string; tail?: string; chest?: string } | undefined;
    if (!photos?.body) missing.push('photos.body');
    if (!photos?.tail) missing.push('photos.tail');
    if (!['adult', 'juvenile'].includes(String(body.ageClass))) missing.push('ageClass');
    if (!['trap', 'gun', 'other'].includes(String(body.captureMethod))) {
      missing.push('captureMethod');
    }
    if (typeof body.capturedAt !== 'string' || Number.isNaN(Date.parse(body.capturedAt))) {
      missing.push('capturedAt');
    }
    if (!['exif', 'manual'].includes(String(body.capturedAtSource))) {
      missing.push('capturedAtSource');
    }
    if (!['exif', 'manual'].includes(String(body.locationSource))) {
      missing.push('locationSource');
    }
    // BR2.17・BR2.18: クマは胸の写真か「撮らなかった」のどちらかが必須。クマ以外には結び付けられない
    if (body.species === 'bear' && !photos?.chest && body.chestPhotoMissing !== true) {
      missing.push('photos.chest');
    }
    if (body.species !== 'bear' && photos?.chest) missing.push('photos.chest');
    if (missing.length > 0) {
      return send(res, 422, {
        code: 'VALIDATION_FAILED',
        message: '項目を確かめてください',
        details: missing.map((field) => ({ field, reason: 'required' })),
      });
    }
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
    // U4（D-8）: 「すべて削除」の確認画面が件数を見せるため、管理者も呼べる
    if (me.role !== 'requester' && me.role !== 'admin') {
      return error(res, 403, 'FORBIDDEN', 'この操作はできません');
    }
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
