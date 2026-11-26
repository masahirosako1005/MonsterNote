// POST /v1/admin/accounts（BR11.1〜BR11.3）。役割・表示名・ID（依頼元は所属も）が必須。
// Cognito 側を先に作り（Q3-A）、成功したら DynamoDB 側（Account・AdminCounter〈roleがadminのときだけ〉）を
// 1つの TransactWriteItems で書く。loginId の一意性は Cognito の UsernameExistsException に任せる
// （reliability-design.md §1。DynamoDB 側に別の一意性確認の仕組みを作らない）。
import { randomInt, randomUUID } from 'node:crypto';
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  type AdminCreateUserCommandOutput,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { TransactWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { errors } from '../shared/errors';
import { json, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import { getCaller, requireRole } from '../shared/auth';
import { publishAuditRecorded, type PublishOptions } from '../shared/events';
import type { Logger } from '../shared/logger';
import { adminCounterIncrementItem } from './admin-counter';
import type { AccountRecord } from './repository';

const ORGANIZATIONS = ['municipality', 'hunters-association'] as const;
const ROLES = ['hunter', 'requester', 'admin'] as const;

export interface CreateAccountInput {
  role: string;
  loginId: string;
  displayName: string;
  organization?: string;
}

export function validateCreateAccountInput(input: CreateAccountInput): string[] {
  const errs: string[] = [];
  if (!(ROLES as readonly string[]).includes(input.role)) errs.push('role');
  if (!/^[A-Za-z0-9]{3,32}$/.test(input.loginId)) errs.push('loginId');
  if (input.displayName.length < 1 || input.displayName.length > 50) errs.push('displayName');
  if (
    input.role === 'requester' &&
    !(ORGANIZATIONS as readonly string[]).includes(input.organization ?? '')
  ) {
    errs.push('organization');
  }
  return errs;
}

/** 12 文字の英小文字と数字（両方を必ず含む。U1 のスクリプトと同じ規則） */
export function generateTemporaryPassword(): string {
  const letters = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface CreateAccountDeps {
  cognito: CognitoIdentityProviderClient;
  ddb: DynamoDBDocumentClient;
  userPoolId: string;
  accountsTable: string;
  adminCounterTable: string;
  eventBridge: EventBridgeClient;
  busName: string;
  logger: Logger;
  now?: () => Date;
  password?: () => string;
  publishOptions?: PublishOptions;
}

export function createCreateAccountRoute(deps: CreateAccountDeps): RouteHandler {
  return async (event) => {
    const caller = getCaller(event);
    requireRole(caller, 'admin'); // 管理者だけ（BR11.1〜BR11.3・BR13.3。U4）
    const body = parseJsonBody(event);
    const input: CreateAccountInput = {
      role: String(body.role ?? ''),
      loginId: String(body.loginId ?? ''),
      displayName: String(body.displayName ?? ''),
      organization: typeof body.organization === 'string' ? body.organization : undefined,
    };
    const problems = validateCreateAccountInput(input);
    if (problems.length > 0) {
      throw errors.unprocessable(
        'VALIDATION_FAILED',
        input.role === 'requester' && problems.includes('organization')
          ? '所属を選んでください'
          : '項目を確かめてください',
        problems.map((field) => ({ field, reason: 'invalid' })),
      );
    }

    const now = (deps.now ?? (() => new Date()))().toISOString();
    const password = (deps.password ?? generateTemporaryPassword)();
    const accountId = randomUUID();

    let created: AdminCreateUserCommandOutput;
    try {
      created = await deps.cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: deps.userPoolId,
          Username: input.loginId,
          TemporaryPassword: password,
          MessageAction: 'SUPPRESS',
          UserAttributes: [{ Name: 'name', Value: input.displayName }],
        }),
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'UsernameExistsException') {
        throw errors.conflict('LOGIN_ID_TAKEN', 'この ID は使われています', {
          loginId: input.loginId,
        });
      }
      throw errors.internal();
    }
    const sub = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    const cognitoAccountId = sub ?? accountId;

    try {
      // U1 のスクリプトと同じく「変更を求めない」状態で設定し、約束 C1 の応答の形を保つ（BR11.3・レビュー R-01）
      await deps.cognito.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: deps.userPoolId,
          Username: input.loginId,
          Password: password,
          Permanent: true,
        }),
      );
      await deps.cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: deps.userPoolId,
          Username: input.loginId,
          GroupName: input.role,
        }),
      );
    } catch {
      throw errors.internal();
    }

    const account: AccountRecord = {
      accountId: cognitoAccountId,
      loginId: input.loginId,
      displayName: input.displayName,
      role: input.role as AccountRecord['role'],
      ...(input.organization
        ? { organization: input.organization as AccountRecord['organization'] }
        : {}),
      status: 'active',
      mustChangePassword: true,
      createdAt: now,
      createdByAccountId: caller.accountId,
      listPartition: 'ALL',
    };

    try {
      await deps.ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: deps.accountsTable, Item: account } },
            ...(input.role === 'admin'
              ? [adminCounterIncrementItem(deps.adminCounterTable, now)]
              : []),
          ],
        }),
      );
    } catch {
      // DynamoDB 側が失敗しても Cognito 側は戻さない（performance-design.md §2 Q3-A の設計どおり。
      // 同じ loginId でもう一度作ろうとすると Cognito 側の重複エラーで気づける）
      throw errors.internal();
    }

    // U4（BR12.5）: 操作の記録。補助的な観測のため、失敗しても主な処理は止めない
    await publishAuditRecorded(
      deps.eventBridge,
      deps.busName,
      'Accounts',
      {
        action: 'account.created',
        targetType: 'account',
        targetId: account.accountId,
        outcome: 'succeeded',
        actorAccountId: caller.accountId,
        actorName: caller.name,
      },
      {
        actorAccountId: caller.accountId,
        now: deps.now,
        publishOptions: deps.publishOptions,
        onError: (err, eventId) =>
          deps.logger.error('audit.recorded を送れなかった', {
            requestId: requestIdOf(event),
            errorCode: 'EVENT_PUBLISH_FAILED',
            eventId,
          }),
      },
    );

    return json(
      200,
      { accountId: account.accountId, temporaryPassword: password },
      requestIdOf(event),
    );
  };
}
