// AdminCounter の試験（entities.md・reliability-design.md §1）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  ADMIN_COUNTER_KEY,
  adminCounterDecrementItem,
  adminCounterIncrementItem,
  createAdminCounterRepository,
} from './admin-counter';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }));
const repo = createAdminCounterRepository(ddb, 'AdminCounter');

beforeEach(() => ddbMock.reset());

describe('adminCounterIncrementItem / adminCounterDecrementItem', () => {
  it('増加は if_not_exists で最初の実行でも安全（行が無くても 1 になる）', () => {
    const item = adminCounterIncrementItem('AdminCounter', '2026-11-25T00:00:00.000Z');
    expect(item.Update?.UpdateExpression).toContain('if_not_exists(activeAdminCount, :zero)');
    expect(item.Update?.Key).toEqual({ counterKey: ADMIN_COUNTER_KEY });
  });

  it('減少は activeAdminCount >= 2 を条件にする（数えてから書かない。BR11.9）', () => {
    const item = adminCounterDecrementItem('AdminCounter', '2026-11-25T00:00:00.000Z');
    expect(item.Update?.ConditionExpression).toBe('activeAdminCount >= :two');
    expect(item.Update?.ExpressionAttributeValues?.[':two']).toBe(2);
  });
});

describe('createAdminCounterRepository', () => {
  it('getCount は行が無ければ 0', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(repo.getCount()).resolves.toBe(0);
  });

  it('getCount は活動中の管理者数を返す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 3 } });
    await expect(repo.getCount()).resolves.toBe(3);
  });

  it('incrementStandalone は TransactWriteItems を1件だけ送る（最初の管理者。スクリプト用）', async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await repo.incrementStandalone('2026-11-25T00:00:00.000Z');
    const calls = ddbMock.commandCalls(TransactWriteCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input.TransactItems).toHaveLength(1);
  });

  it('reconcile は実際の件数と違うときだけ上書きする', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 2 } });
    await repo.reconcile(2, '2026-11-25T00:00:00.000Z');
    // UpdateCommand（上書き）は呼ばれない
    expect(
      ddbMock.calls().filter((c) => c.args[0].constructor.name === 'UpdateCommand'),
    ).toHaveLength(0);

    ddbMock.resetHistory();
    ddbMock.on(GetCommand).resolves({ Item: { activeAdminCount: 2 } });
    await repo.reconcile(3, '2026-11-25T00:00:00.000Z');
    const updateCalls = ddbMock
      .calls()
      .filter((c) => c.args[0].constructor.name === 'UpdateCommand');
    expect(updateCalls).toHaveLength(1);
  });
});
