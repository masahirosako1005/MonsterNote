// 有効な管理者の数（AdminCounter）。最後の 1 人を無効にできないようにするためだけに持つ
// （entities.md・reliability-design.md §1）。1 行だけの表（counterKey 固定）。
import {
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

export const ADMIN_COUNTER_KEY = 'admin-counter';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

/** 管理者を作った・有効に戻したときの +1（TransactWriteItems に混ぜる用）。行がまだ無くても安全（if_not_exists） */
export function adminCounterIncrementItem(tableName: string, now: string): TransactItem {
  return {
    Update: {
      TableName: tableName,
      Key: { counterKey: ADMIN_COUNTER_KEY },
      UpdateExpression:
        'SET activeAdminCount = if_not_exists(activeAdminCount, :zero) + :one, updatedAt = :now',
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now },
    },
  };
}

/** 管理者を無効にしたときの -1。「2 以上である」ことを条件にする（数えてから書く形にしない。BR11.9） */
export function adminCounterDecrementItem(tableName: string, now: string): TransactItem {
  return {
    Update: {
      TableName: tableName,
      Key: { counterKey: ADMIN_COUNTER_KEY },
      UpdateExpression: 'SET activeAdminCount = activeAdminCount - :one, updatedAt = :now',
      ConditionExpression: 'activeAdminCount >= :two',
      ExpressionAttributeValues: { ':one': 1, ':two': 2, ':now': now },
    },
  };
}

export interface AdminCounterRepository {
  /** 最初の管理者（スクリプト）。行が無ければ 1 で作る */
  incrementStandalone(now: string): Promise<void>;
  getCount(): Promise<number>;
  /** 一覧を開いたときのずれの数え直し（reliability-design.md §1）。実際の件数と違えば上書きする */
  reconcile(actualCount: number, now: string): Promise<void>;
}

export function createAdminCounterRepository(
  ddb: DynamoDBDocumentClient,
  tableName: string,
): AdminCounterRepository {
  return {
    async incrementStandalone(now) {
      await ddb.send(
        new TransactWriteCommand({ TransactItems: [adminCounterIncrementItem(tableName, now)] }),
      );
    },
    async getCount() {
      const res = await ddb.send(
        new GetCommand({ TableName: tableName, Key: { counterKey: ADMIN_COUNTER_KEY } }),
      );
      return (res.Item?.activeAdminCount as number | undefined) ?? 0;
    },
    async reconcile(actualCount, now) {
      const current = await this.getCount();
      if (current === actualCount) return;
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { counterKey: ADMIN_COUNTER_KEY },
          UpdateExpression: 'SET activeAdminCount = :count, updatedAt = :now',
          ExpressionAttributeValues: { ':count': actualCount, ':now': now },
        }),
      );
    },
  };
}
