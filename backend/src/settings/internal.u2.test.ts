// 設定の読み出しの内部の呼び出しの試験（BR9.1）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { isSettingsReadRequest, readSettings } from './internal';
import { createSettingsRepository } from './repository';
import { clients, fixedNow } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createSettingsRepository(c.ddb, 'Settings');

beforeEach(() => ddbMock.reset());

describe('readSettings', () => {
  it('ログイン済みの利用者（caller 転送）は許す（BR9.1）', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await readSettings(
      repo,
      {
        kind: 'settings-read',
        auth: { authKind: 'caller', caller: { sub: 'hunter-a', roles: ['hunter'] } },
      },
      fixedNow('2026-11-23T00:00:00.000Z'),
    );
    expect(result).toMatchObject({ duplicateDistanceMeters: 1000, duplicateWindowHours: 24 });
  });

  it('DuplicateDetection の部品の身元の証明は許す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(
      readSettings(repo, {
        kind: 'settings-read',
        auth: { authKind: 'component', component: 'DuplicateDetection' },
      }),
    ).resolves.toMatchObject({ duplicateDistanceMeters: 1000 });
  });

  it('caller の sub が空なら拒む（401 相当）', async () => {
    await expect(
      readSettings(repo, {
        kind: 'settings-read',
        auth: { authKind: 'caller', caller: { sub: '', roles: [] } },
      }),
    ).rejects.toThrow();
  });

  it('設定の行があればそれを返す（初期値を使わない）', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        settingKey: 'default',
        duplicateDistanceMeters: 2000,
        duplicateWindowHours: 48,
        targetAreaNorth: 46,
        targetAreaSouth: 20,
        targetAreaEast: 154,
        targetAreaWest: 122,
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    });
    const result = await readSettings(repo, {
      kind: 'settings-read',
      auth: { authKind: 'caller', caller: { sub: 'hunter-a', roles: ['hunter'] } },
    });
    expect(result.duplicateDistanceMeters).toBe(2000);
  });
});

describe('isSettingsReadRequest', () => {
  it('kind=settings-read の形だけを見分ける', () => {
    expect(
      isSettingsReadRequest({
        kind: 'settings-read',
        auth: { authKind: 'component', component: 'DuplicateDetection' },
      }),
    ).toBe(true);
    expect(isSettingsReadRequest({ requestContext: {} })).toBe(false);
    expect(isSettingsReadRequest(null)).toBe(false);
  });
});
