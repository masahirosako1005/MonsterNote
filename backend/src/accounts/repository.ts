// Accounts の表（キー accountId、索引 loginId）の読み書き。entities.md の Account。
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Role } from '../shared/auth';

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
  hunterNumber?: string;
  createdAt: string;
}

export interface AccountsRepository {
  getById(accountId: string): Promise<AccountRecord | undefined>;
  create(account: AccountRecord): Promise<void>;
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
          Item: account,
          ConditionExpression: 'attribute_not_exists(accountId)',
        }),
      );
    },
  };
}
