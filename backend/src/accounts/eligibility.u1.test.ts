// 内部の呼び出し C10「報告できるハンターか」の試験（BR2.1、security-design NFR4.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { checkReportEligibility, isEligibilityRequest } from './eligibility';
import { createAccountsRepository, type AccountRecord } from './repository';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' })),
  'Accounts',
);

const hunter: AccountRecord = {
  accountId: 'hunter-a',
  loginId: 'hunter01',
  displayName: 'ハンター A',
  role: 'hunter',
  status: 'active',
  mustChangePassword: false,
  consentedAt: '2026-11-01T00:00:00.000Z',
  hunterNumber: '123',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const request = (overrides: Partial<{ accountId: string; sub: string; roles: string[] }> = {}) => ({
  kind: 'report-eligibility' as const,
  accountId: overrides.accountId ?? 'hunter-a',
  caller: { sub: overrides.sub ?? 'hunter-a', roles: overrides.roles ?? ['hunter'] },
});

beforeEach(() => ddbMock.reset());

describe('checkReportEligibility', () => {
  it('同意と従事者番号があれば eligible と従事者番号・表示名を返す', async () => {
    ddbMock.on(GetCommand).resolves({ Item: hunter });
    await expect(checkReportEligibility(repo, request())).resolves.toEqual({
      eligible: true,
      hunterNumber: '123',
      displayName: 'ハンター A',
    });
  });

  it('同意していなければ eligible=false', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...hunter, consentedAt: undefined } });
    await expect(checkReportEligibility(repo, request())).resolves.toEqual({
      eligible: false,
      displayName: 'ハンター A',
    });
  });

  it('従事者番号がなければ eligible=false', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...hunter, hunterNumber: undefined } });
    const res = await checkReportEligibility(repo, request());
    expect(res).toMatchObject({ eligible: false });
  });

  it('アカウントがない・無効なら eligible=false', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    await expect(checkReportEligibility(repo, request())).resolves.toEqual({ eligible: false });
    ddbMock.on(GetCommand).resolves({ Item: { ...hunter, status: 'disabled' } });
    expect(await checkReportEligibility(repo, request())).toMatchObject({ eligible: false });
  });

  it('呼び出しの中の利用者がハンターでなければ拒否する（FORBIDDEN）', async () => {
    await expect(checkReportEligibility(repo, request({ roles: ['requester'] }))).resolves.toEqual({
      error: 'FORBIDDEN',
    });
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(0);
  });

  it('利用者本人以外のアカウントは問い合わせられない（FORBIDDEN）', async () => {
    await expect(checkReportEligibility(repo, request({ sub: 'hunter-b' }))).resolves.toEqual({
      error: 'FORBIDDEN',
    });
  });

  it('アカウントの役割がハンターでなければ eligible=false', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...hunter, role: 'requester' } });
    expect(await checkReportEligibility(repo, request())).toMatchObject({ eligible: false });
  });
});

describe('isEligibilityRequest', () => {
  it('直接の呼び出しの形かを見分ける（API Gateway のイベントは違う）', () => {
    expect(isEligibilityRequest(request())).toBe(true);
    expect(isEligibilityRequest({ requestContext: {} })).toBe(false);
    expect(isEligibilityRequest(null)).toBe(false);
  });
});
