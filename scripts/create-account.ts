// アカウントを作るスクリプト（U1 の手順書。BR5.1、UC7、NFR6.3）。
// 使い方:
//   USER_POOL_ID=... ACCOUNTS_TABLE=... npm run account:create -- --role hunter --login-id hunter01 \
//     --display-name "ハンター A" --hunter-number 123
//   npm run account:create -- --role requester --login-id city01 --display-name "市の担当" --organization municipality
// 開発者の手元の AWS の認証情報（default のプロファイル）を使う。仮のパスワードは標準出力に 1 回だけ出す（ファイルに書かない）。
import { randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

export interface CreateAccountInput {
  role: string;
  loginId: string;
  displayName: string;
  organization?: string;
  hunterNumber?: string;
}

export interface CreateAccountDeps {
  cognito: CognitoIdentityProviderClient;
  ddb: DynamoDBDocumentClient;
  userPoolId: string;
  accountsTable: string;
  now?: () => Date;
  out?: (line: string) => void;
  password?: () => string;
}

const ORGANIZATIONS = ['municipality', 'hunters-association'];

/** "--login-id x" の形の引数を読む */
export function parseArgs(argv: string[]): CreateAccountInput {
  const map: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith('--') && value !== undefined) map[key.slice(2)] = value;
  }
  const input: CreateAccountInput = {
    role: map.role ?? '',
    loginId: map['login-id'] ?? '',
    displayName: map['display-name'] ?? '',
  };
  if (map.organization) input.organization = map.organization;
  if (map['hunter-number']) input.hunterNumber = map['hunter-number'];
  return input;
}

/** BR5.1 と entities.md の制約。誤りの文の一覧を返す（空なら正しい） */
export function validateInput(input: CreateAccountInput): string[] {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9]{3,32}$/.test(input.loginId)) errors.push('--login-id は英数字 3〜32 文字です');
  if (input.displayName.length < 1 || input.displayName.length > 50) {
    errors.push('--display-name は 1〜50 文字です');
  }
  if (input.role === 'hunter') {
    if (!input.hunterNumber || !/^[0-9]{1,20}$/.test(input.hunterNumber)) {
      errors.push('ハンターには --hunter-number（数字 1〜20 桁）が必要です');
    }
  } else if (input.role === 'requester') {
    if (!input.organization || !ORGANIZATIONS.includes(input.organization)) {
      errors.push(`依頼元には --organization（${ORGANIZATIONS.join(' か ')}）が必要です`);
    }
  } else if (input.role === 'admin') {
    errors.push('U1 では admin のアカウントは作れません（管理者の画面は U4）');
  } else {
    errors.push('--role は hunter か requester です');
  }
  return errors;
}

/** 12 文字の英小文字と数字（両方を必ず含む。Cognito のパスワードの規則に合わせる） */
export function generateTemporaryPassword(): string {
  const letters = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  // 先頭の 2 文字の位置を混ぜる
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export async function createAccount(
  deps: CreateAccountDeps,
  input: CreateAccountInput,
): Promise<{ accountId: string }> {
  const problems = validateInput(input);
  if (problems.length > 0) throw new Error(problems.join('\n'));

  const now = (deps.now ?? (() => new Date()))().toISOString();
  const out = deps.out ?? ((line: string) => console.log(line));
  const password = (deps.password ?? generateTemporaryPassword)();

  const created = await deps.cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: deps.userPoolId,
      Username: input.loginId,
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS',
      UserAttributes: [{ Name: 'name', Value: input.displayName }],
    }),
  );
  const accountId = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!accountId) throw new Error('Cognito のユーザーの sub を読めませんでした');

  try {
    // U1 ではパスワードの変更の画面がないため、変更を求めない状態にする（mustChangePassword=false）
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
    await deps.ddb.send(
      new PutCommand({
        TableName: deps.accountsTable,
        Item: {
          accountId,
          loginId: input.loginId,
          displayName: input.displayName,
          role: input.role,
          ...(input.organization ? { organization: input.organization } : {}),
          status: 'active',
          mustChangePassword: false,
          ...(input.role === 'hunter'
            ? { consentedAt: now, hunterNumber: input.hunterNumber }
            : {}),
          createdAt: now,
        },
        ConditionExpression: 'attribute_not_exists(accountId)',
      }),
    );
  } catch (err) {
    // 途中で失敗したら、作ったユーザーを消して「何も作らない」状態に戻す
    await deps.cognito.send(
      new AdminDeleteUserCommand({ UserPoolId: deps.userPoolId, Username: input.loginId }),
    );
    throw err;
  }

  out(`アカウントを作りました: ${input.loginId}（${input.role}）`);
  out(`仮のパスワード（この 1 回だけ表示します）: ${password}`);
  return { accountId };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const userPoolId = process.env.USER_POOL_ID;
  const accountsTable = process.env.ACCOUNTS_TABLE;
  if (!userPoolId || !accountsTable) {
    throw new Error(
      '環境変数 USER_POOL_ID と ACCOUNTS_TABLE を入れてください（cdk deploy の出力にあります）',
    );
  }
  const region = process.env.AWS_REGION ?? 'ap-northeast-1';
  await createAccount(
    {
      cognito: new CognitoIdentityProviderClient({ region }),
      ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region })),
      userPoolId,
      accountsTable,
    },
    input,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
