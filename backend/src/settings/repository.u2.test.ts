// Settings の表（キー settingKey）への読み書きの試験
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createSettingsRepository, SETTINGS_KEY, type SettingRecord } from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createSettingsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Settings',
);

const record: SettingRecord = {
  settingKey: SETTINGS_KEY,
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
  updatedAt: '2026-11-23T00:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('createSettingsRepository', () => {
  it('設定を作る（put）', async () => {
    ddbMock.on(PutCommand).resolves({});
    await repo.put(record);
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
      TableName: 'Settings',
      Item: record,
    });
  });

  it('固定のキーで設定を読む（get）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: record });
    await expect(repo.get()).resolves.toEqual(record);
    expect(ddbMock.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
      TableName: 'Settings',
      Key: { settingKey: SETTINGS_KEY },
    });
  });

  it('設定の行がまだないときは undefined（BR9.3 の初期値は呼ぶ側が補う）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(repo.get()).resolves.toBeUndefined();
  });
});
