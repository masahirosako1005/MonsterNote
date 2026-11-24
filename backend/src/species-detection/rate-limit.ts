// 判別の呼び出し回数の上限（NFR12.5、scalability-design §1）。
// DetectionRateLimit の表（キー accountId#date）を if_not_exists を使ったアトミックな更新式で 1 増やし、
// 「行を作る」と「1 増やす」を 1 回の条件付き書き換えにする（数えてから書く形の競合を避ける）。
import { UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';

/** 1 日あたりの判別の呼び出しの上限（NFR12.5） */
export const DAILY_DETECTION_LIMIT = 30;
/** 作成から 2 日後に TTL で消える（scalability-design §1） */
const RATE_LIMIT_TTL_SECONDS = 2 * 24 * 60 * 60;

/** 日本時間（JST, UTC+9）の日付キー（YYYY-MM-DD）。サーバーの既定のタイムゾーンに依存しない */
export function jstDateKeyOf(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export interface DetectionRateLimiter {
  /** その日の呼び出しを 1 件消費できるか。上限に達していれば false（判別は呼ばない） */
  tryConsume(accountId: string): Promise<boolean>;
}

export function createDetectionRateLimiter(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  now: () => Date = () => new Date(),
): DetectionRateLimiter {
  return {
    async tryConsume(accountId) {
      const key = `${accountId}#${jstDateKeyOf(now())}`;
      const ttl = Math.floor(now().getTime() / 1000) + RATE_LIMIT_TTL_SECONDS;
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { accountIdDate: key },
            UpdateExpression:
              'SET callCount = if_not_exists(callCount, :zero) + :one, #ttl = if_not_exists(#ttl, :ttlValue)',
            ConditionExpression: 'callCount < :limit OR attribute_not_exists(callCount)',
            ExpressionAttributeNames: { '#ttl': 'ttl' },
            ExpressionAttributeValues: {
              ':zero': 0,
              ':one': 1,
              ':limit': DAILY_DETECTION_LIMIT,
              ':ttlValue': ttl,
            },
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },
  };
}
