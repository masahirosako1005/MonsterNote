// batchDeleteAll の試験（BR13.1。performance-design.md §3）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { batchDeleteAll } from './batch-delete';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));

beforeEach(() => ddbMock.reset());

describe('batchDeleteAll', () => {
  it('すでに0件なら0件で成功する（冪等。BR13.1）', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    await expect(batchDeleteAll(ddb, 'Reports', ['reportId'])).resolves.toBe(0);
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(0);
  });

  it('25件ずつBatchWriteItemで消し、残りが無くなるまで繰り返す', async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({ reportId: `r${i}` }));
    const page2 = Array.from({ length: 10 }, (_, i) => ({ reportId: `r${25 + i}` }));
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: page1, LastEvaluatedKey: { reportId: 'r24' } })
      .resolvesOnce({ Items: page2 });
    ddbMock.on(BatchWriteCommand).resolves({});
    const count = await batchDeleteAll(ddb, 'Reports', ['reportId']);
    expect(count).toBe(35);
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
    expect(
      ddbMock.commandCalls(BatchWriteCommand)[0]?.args[0].input.RequestItems?.Reports,
    ).toHaveLength(25);
  });

  it('UnprocessedItemsが残ったらやり直す（スロットリング対策）', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ reportId: 'r1' }, { reportId: 'r2' }] });
    ddbMock
      .on(BatchWriteCommand)
      .resolvesOnce({
        UnprocessedItems: { Reports: [{ DeleteRequest: { Key: { reportId: 'r2' } } }] },
      })
      .resolvesOnce({});
    const count = await batchDeleteAll(ddb, 'Reports', ['reportId']);
    expect(count).toBe(2);
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
  });

  it('複合キー（例: suspicionId）も渡せる', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ suspicionId: 's1' }] });
    ddbMock.on(BatchWriteCommand).resolves({});
    await batchDeleteAll(ddb, 'DuplicateSuspicions', ['suspicionId']);
    const scanInput = ddbMock.commandCalls(ScanCommand)[0]?.args[0].input;
    expect(scanInput?.ProjectionExpression).toBe('suspicionId');
  });
});
