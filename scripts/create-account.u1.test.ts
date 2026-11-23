// アカウントを作るスクリプトの試験（BR5.1、NFR6.3）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  createAccount,
  generateTemporaryPassword,
  parseArgs,
  validateInput,
} from './create-account';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const ddbMock = mockClient(DynamoDBDocumentClient);
const credentials = { accessKeyId: 'test', secretAccessKey: 'test' };
const region = 'ap-northeast-1';

function deps() {
  const lines: string[] = [];
  return {
    lines,
    deps: {
      cognito: new CognitoIdentityProviderClient({ region, credentials }),
      ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials })),
      userPoolId: 'pool-1',
      accountsTable: 'Accounts',
      now: () => new Date('2026-11-23T05:00:00.000Z'),
      out: (line: string) => lines.push(line),
      password: () => 'abcd1234efgh',
    },
  };
}

beforeEach(() => {
  cognitoMock.reset();
  ddbMock.reset();
  cognitoMock.on(AdminCreateUserCommand).resolves({
    User: { Attributes: [{ Name: 'sub', Value: 'sub-123' }] },
  });
  cognitoMock.on(AdminSetUserPasswordCommand).resolves({});
  cognitoMock.on(AdminAddUserToGroupCommand).resolves({});
  ddbMock.on(PutCommand).resolves({});
});

describe('validateInput', () => {
  it('ハンターは従事者番号が必須、依頼元は所属が必須、admin は U1 では作らない', () => {
    expect(
      validateInput({ role: 'hunter', loginId: 'hunter01', displayName: 'A' }).join(),
    ).toContain('--hunter-number');
    expect(
      validateInput({ role: 'requester', loginId: 'req01', displayName: 'B' }).join(),
    ).toContain('--organization');
    expect(validateInput({ role: 'admin', loginId: 'adm01', displayName: 'C' }).join()).toContain(
      'admin',
    );
    expect(
      validateInput({ role: 'hunter', loginId: 'hunter01', displayName: 'A', hunterNumber: '123' }),
    ).toEqual([]);
  });

  it('ID は英数字 3〜32 文字、表示名は 1〜50 文字、従事者番号は数字 1〜20 桁', () => {
    const errors = validateInput({
      role: 'hunter',
      loginId: 'a!',
      displayName: '',
      hunterNumber: '12a',
    });
    expect(errors.join('\n')).toMatch(/--login-id/);
    expect(errors.join('\n')).toMatch(/--display-name/);
    expect(errors.join('\n')).toMatch(/--hunter-number/);
  });
});

describe('parseArgs と generateTemporaryPassword', () => {
  it('--名前 値 の形の引数を読む', () => {
    expect(
      parseArgs([
        '--role',
        'requester',
        '--login-id',
        'req01',
        '--display-name',
        '市の担当',
        '--organization',
        'municipality',
      ]),
    ).toEqual({
      role: 'requester',
      loginId: 'req01',
      displayName: '市の担当',
      organization: 'municipality',
    });
  });

  it('仮のパスワードは 12 文字で、英小文字と数字を必ず含む（パスワードの規則 NFR4.5）', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateTemporaryPassword();
      expect(p).toMatch(/^[a-z0-9]{12}$/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });
});

describe('createAccount', () => {
  it('ハンター: Cognito のユーザー・グループと Accounts の表を作り、同意の日時を入れ、仮のパスワードを 1 回だけ出す', async () => {
    const { deps: d, lines } = deps();
    const result = await createAccount(d, {
      role: 'hunter',
      loginId: 'hunter01',
      displayName: 'ハンター A',
      hunterNumber: '123',
    });
    expect(result.accountId).toBe('sub-123');
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)[0]?.args[0].input).toMatchObject({
      UserPoolId: 'pool-1',
      Username: 'hunter01',
      MessageAction: 'SUPPRESS',
      UserAttributes: [{ Name: 'name', Value: 'ハンター A' }],
    });
    // U1 ではパスワードの変更の画面がないため、変更を求めない状態で作る
    expect(cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0]?.args[0].input).toMatchObject({
      Username: 'hunter01',
      Password: 'abcd1234efgh',
      Permanent: true,
    });
    expect(cognitoMock.commandCalls(AdminAddUserToGroupCommand)[0]?.args[0].input.GroupName).toBe(
      'hunter',
    );
    expect(ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item).toEqual({
      accountId: 'sub-123',
      loginId: 'hunter01',
      displayName: 'ハンター A',
      role: 'hunter',
      status: 'active',
      mustChangePassword: false,
      consentedAt: '2026-11-23T05:00:00.000Z',
      hunterNumber: '123',
      createdAt: '2026-11-23T05:00:00.000Z',
    });
    expect(lines.filter((l) => l.includes('abcd1234efgh'))).toHaveLength(1);
  });

  it('依頼元: 所属を入れ、同意の日時と従事者番号は入れない', async () => {
    const { deps: d } = deps();
    await createAccount(d, {
      role: 'requester',
      loginId: 'req01',
      displayName: '市の担当',
      organization: 'municipality',
    });
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item;
    expect(item).toMatchObject({ role: 'requester', organization: 'municipality' });
    expect(item).not.toHaveProperty('consentedAt');
    expect(item).not.toHaveProperty('hunterNumber');
  });

  it('決まりに合わなければ、何も作らずにエラーで止まる', async () => {
    const { deps: d } = deps();
    await expect(
      createAccount(d, { role: 'admin', loginId: 'adm01', displayName: 'C' }),
    ).rejects.toThrow();
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('表の書き込みに失敗したら、作った Cognito のユーザーを消して止まる', async () => {
    const { deps: d, lines } = deps();
    ddbMock.on(PutCommand).rejects(new Error('dynamodb down'));
    cognitoMock.on(AdminDeleteUserCommand).resolves({});
    await expect(
      createAccount(d, {
        role: 'hunter',
        loginId: 'hunter01',
        displayName: 'A',
        hunterNumber: '1',
      }),
    ).rejects.toThrow('dynamodb down');
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)).toHaveLength(1);
    expect(lines.some((l) => l.includes('abcd1234efgh'))).toBe(false);
  });
});
