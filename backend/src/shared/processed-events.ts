// 知らせの受け手が「処理済みの eventId」を覚える表（ProcessedEvents。キー consumer#eventId、TTL 7 日）。
// NFR10.4: 2 回目の知らせは何もしない。処理が終わってから記録するため、途中で失敗した知らせは EventBridge のやり直しで処理される。
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const PROCESSED_EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface ProcessedEvents {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

export function createProcessedEvents(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  consumer: string,
  now: () => Date = () => new Date(),
): ProcessedEvents {
  const keyOf = (eventId: string) => `${consumer}#${eventId}`;
  return {
    async isProcessed(eventId) {
      const res = await ddb.send(
        new GetCommand({ TableName: tableName, Key: { consumerEventId: keyOf(eventId) } }),
      );
      return res.Item !== undefined;
    },
    async markProcessed(eventId) {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            consumerEventId: keyOf(eventId),
            expiresAt: Math.floor(now().getTime() / 1000) + PROCESSED_EVENT_TTL_SECONDS,
          },
        }),
      );
    },
  };
}
