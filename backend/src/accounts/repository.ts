// Accounts の表（キー accountId、索引 loginId・gsiAll〈一覧用〉）の読み書き。entities.md の Account。
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { Role } from '../shared/auth';

export const ACCOUNTS_ALL_PARTITION = 'ALL';
export const ACCOUNTS_INDEX_ALL = 'gsiAll';

export interface AccountRecord {
  /** Cognito のユーザーの sub と同じ値 */
  accountId: string;
  loginId: string;
  displayName: string;
  role: Role;
  organization?: 'municipality' | 'hunters-association';
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  consentedAt?: string;
  /** 「同意しない」を押した日時（記録のためだけ。同意の有無は consentedAt で判断。U4） */
  consentDeclinedAt?: string;
  hunterNumber?: string;
  createdAt: string;
  /** 作った管理者。スクリプトで作った最初の管理者は空（U4） */
  createdByAccountId?: string;
  /** 最後に使った日時（30 日の判定用。U4で明示） */
  lastActiveAt?: string;
  /** 一覧（gsiAll）の固定のパーティション値。常に ACCOUNTS_ALL_PARTITION（U4） */
  listPartition?: string;
}

export type AccountUpdatePatch = Partial<
  Pick<
    AccountRecord,
    | 'mustChangePassword'
    | 'consentedAt'
    | 'consentDeclinedAt'
    | 'hunterNumber'
    | 'lastActiveAt'
    | 'status'
  >
>;

export interface AccountsRepository {
  getById(accountId: string): Promise<AccountRecord | undefined>;
  create(account: AccountRecord): Promise<void>;
  /** 項目の一部だけを書き換える（承認・無効化の条件付きトランザクションは set-status.ts が別に行う） */
  update(accountId: string, patch: AccountUpdatePatch): Promise<void>;
  /** 一覧（U4。GET /v1/admin/accounts）。20 人以下の規模のため 1 回のクエリで足りる（NFR2.1） */
  list(): Promise<AccountRecord[]>;
}

export function createAccountsRepository(
  ddb: DynamoDBDocumentClient,
  tableName: string,
): AccountsRepository {
  return {
    async getById(accountId) {
      const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { accountId } }));
      return res.Item as AccountRecord | undefined;
    },
    async create(account) {
      // 同じ accountId を上書きしない
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: { ...account, listPartition: ACCOUNTS_ALL_PARTITION },
          ConditionExpression: 'attribute_not_exists(accountId)',
        }),
      );
    },
    async update(accountId, patch) {
      const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return;
      const sets = entries.map((_, i) => `#k${i} = :v${i}`).join(', ');
      const names = Object.fromEntries(entries.map(([k], i) => [`#k${i}`, k]));
      const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { accountId },
          UpdateExpression: `SET ${sets}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
    },
    async list() {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: ACCOUNTS_INDEX_ALL,
          KeyConditionExpression: 'listPartition = :p',
          ExpressionAttributeValues: { ':p': ACCOUNTS_ALL_PARTITION },
        }),
      );
      return (res.Items ?? []) as AccountRecord[];
    },
  };
}
