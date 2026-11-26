// Settings の表（キー settingKey。1 行だけ）の読み書き。entities.md の Setting。
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/** 1 行だけ持つための固定のキー（entities.md） */
export const SETTINGS_KEY = 'default';

export interface SettingRecord {
  settingKey: string;
  duplicateDistanceMeters: number;
  duplicateWindowHours: number;
  targetAreaNorth: number;
  targetAreaSouth: number;
  targetAreaEast: number;
  targetAreaWest: number;
  updatedByAccountId?: string;
  updatedAt: string;
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

export function createSettingsRepository(ddb: DynamoDBDocumentClient, tableName: string) {
  return {
    /** 設定がまだ作られていないときは undefined（呼ぶ側が初期値〈BR9.3〉を補う） */
    async get(): Promise<SettingRecord | undefined> {
      const res = await ddb.send(
        new GetCommand({ TableName: tableName, Key: { settingKey: SETTINGS_KEY } }),
      );
      return res.Item as SettingRecord | undefined;
    },

    async put(record: SettingRecord): Promise<void> {
      await ddb.send(new PutCommand({ TableName: tableName, Item: record }));
    },
  };
}
