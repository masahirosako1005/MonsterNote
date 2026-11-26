// 「すべて削除」の共通の処理（U4・BR13.1、performance-design.md §3）。
// 対象の表のキーだけを最大25件ずつ読み、BatchWriteItemで消すのを、残りがなくなるまで繰り返す。
// すでに0件なら0件で成功する（冪等）。1回のAPI呼び出しの中でループして全部消し終えてから応答する（Q2-A）。
import { BatchWriteCommand, ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const BATCH_SIZE = 25;

export interface BatchDeleteAllOptions {
  /** テスト用に1回のScanの読み出し件数を変える（既定はBATCH_SIZE） */
  scanLimit?: number;
}

/**
 * keyAttributes で指定した属性だけを読み（例: ['reportId']）、その表から全件を削除する。
 * 戻り値は消した件数。
 */
export async function batchDeleteAll(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  keyAttributes: string[],
  options: BatchDeleteAllOptions = {},
): Promise<number> {
  let deleted = 0;
  const limit = options.scanLimit ?? BATCH_SIZE;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  for (;;) {
    const scanRes = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: keyAttributes.join(', '),
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );
    const items = scanRes.Items ?? [];
    if (items.length === 0 && !scanRes.LastEvaluatedKey) break;

    if (items.length > 0) {
      let requestItems: Record<string, { DeleteRequest: { Key: Record<string, unknown> } }[]> = {
        [tableName]: items.map((item) => ({ DeleteRequest: { Key: item } })),
      };
      // スロットリングなどで一部が UnprocessedItems に残ることがある。すべて片付くまでやり直す
      for (;;) {
        const res = await ddb.send(new BatchWriteCommand({ RequestItems: requestItems }));
        const unprocessed = res.UnprocessedItems?.[tableName];
        if (!unprocessed || unprocessed.length === 0) break;
        requestItems = {
          [tableName]: unprocessed as { DeleteRequest: { Key: Record<string, unknown> } }[],
        };
      }
      deleted += items.length;
    }

    lastEvaluatedKey = scanRes.LastEvaluatedKey;
    if (!lastEvaluatedKey) break;
  }

  return deleted;
}
