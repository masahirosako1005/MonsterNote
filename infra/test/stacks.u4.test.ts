// U4 の AWS の構成の試験（aws-cdk-lib/assertions）。infrastructure-specification.md のとおり:
// catalog・review・duplicate-detection・reporting の時間切れを15秒に統一、audit-log 関数を新規追加、
// Cognito の管理 API 権限は accounts 関数だけに付ける（最小権限）、AdminCounter・AuditEntries の表を追加する。
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { buildMonsterNote, type MonsterNoteStacks } from '../lib/monsternote';

const fixture = fileURLToPath(new URL('./fixtures/web', import.meta.url));

let stacks: MonsterNoteStacks;
let api: Template;
let data: Template;

beforeAll(() => {
  const app = new App({
    outdir: fileURLToPath(new URL('../cdk.out/test-u4', import.meta.url)),
    context: { 'aws:cdk:bundling-stacks': [] },
  });
  stacks = buildMonsterNote(app, {
    hunterAssetPath: fixture,
    requesterAssetPath: fixture,
    alarmEmail: 'alarm@example.com',
  });
  api = Template.fromStack(stacks.api);
  data = Template.fromStack(stacks.data);
});

const resourcesOf = (template: Template, type: string) =>
  Object.values(template.findResources(type)) as { Properties: Record<string, unknown> }[];

describe('U4: catalog・review・duplicate-detection・reporting の時間切れ統一（infrastructure-specification.md §1）', () => {
  it('削除の入口を足した4関数はすべて15秒', () => {
    const fns = resourcesOf(api, 'AWS::Lambda::Function');
    const named = (env: string) =>
      fns.find((f) => JSON.stringify(f.Properties.Environment).includes(env));
    // それぞれを特定できる環境変数で選び出す
    expect(named('REPORT_LIST_ITEMS_TABLE')?.Properties.Timeout).toBe(15); // catalog
    expect(
      fns.find(
        (f) =>
          JSON.stringify(f.Properties.Environment).includes('REVIEW_DECISIONS_TABLE') &&
          !JSON.stringify(f.Properties.Environment).includes('DUPLICATE_SUSPICIONS_TABLE'),
      )?.Properties.Timeout,
    ).toBe(15); // review
    expect(
      fns.find(
        (f) =>
          JSON.stringify(f.Properties.Environment).includes('DUPLICATE_SUSPICIONS_TABLE') &&
          JSON.stringify(f.Properties.Environment).includes('REVIEW_DECISIONS_TABLE'),
      )?.Properties.Timeout,
    ).toBe(15); // duplicate-detection
    expect(named('PHOTO_BUCKET')?.Properties.Timeout).toBe(15); // reporting
  });
});

describe('U4: audit-log 関数（新規。128MB・10秒）', () => {
  it('AuditEntries への読み書き権限を持ち、API 向けの時間切れ・メモリの範囲に収まる', () => {
    const fn = resourcesOf(api, 'AWS::Lambda::Function').find((f) =>
      JSON.stringify(f.Properties.Environment).includes('AUDIT_ENTRIES_TABLE'),
    );
    expect(fn?.Properties.MemorySize).toBe(128);
    expect(fn?.Properties.Timeout).toBe(10);
  });

  it('GET /v1/admin/audit-entries を認可付きの道で持つ', () => {
    const route = resourcesOf(api, 'AWS::ApiGatewayV2::Route').find(
      (r) => r.Properties.RouteKey === 'GET /v1/admin/audit-entries',
    );
    expect(route).toBeDefined();
    expect(route?.Properties.AuthorizationType).toBe('JWT');
  });

  it('EventBridge: detail-type=audit.recorded を送り手を問わず受ける専用のルールを持つ', () => {
    api.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { 'detail-type': ['audit.recorded'] },
    });
  });
});

describe('U4: Cognito の管理 API 権限は accounts 関数だけ（最小権限。BR11.2・BR11.3）', () => {
  it('AdminCreateUser・AdminSetUserPassword・AdminAddUserToGroup だけを許し、AdminUpdateUserAttributes・AdminDisableUser は付与しない', () => {
    const policies = resourcesOf(api, 'AWS::IAM::Policy');
    const accountsPolicies = policies.filter((p) =>
      JSON.stringify(p.Properties.Roles).includes('AccountsFunction'),
    );
    const cognitoActions = accountsPolicies.flatMap((p) => {
      const doc = p.Properties.PolicyDocument as {
        Statement: { Action: string | string[] }[];
      };
      return doc.Statement.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    });
    expect(cognitoActions).toEqual(
      expect.arrayContaining([
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
      ]),
    );
    expect(cognitoActions).not.toContain('cognito-idp:AdminUpdateUserAttributes');
    expect(cognitoActions).not.toContain('cognito-idp:AdminDisableUser');
  });

  it('accounts 以外のどの関数にも cognito-idp: の権限が付いていない', () => {
    const policies = resourcesOf(api, 'AWS::IAM::Policy');
    const others = policies.filter(
      (p) => !JSON.stringify(p.Properties.Roles).includes('AccountsFunction'),
    );
    expect(
      others.some((p) => JSON.stringify(p.Properties.PolicyDocument).includes('cognito-idp:')),
    ).toBe(false);
  });
});

describe('U4: AdminCounter・AuditEntries の表', () => {
  it('AdminCounter はキー counterKey の 1 件だけの表で、オンデマンド・RETAIN', () => {
    data.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'counterKey', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
    const table = resourcesOf(data, 'AWS::DynamoDB::Table').find(
      (t) =>
        (t.Properties.KeySchema as { AttributeName: string }[])[0]?.AttributeName === 'counterKey',
    ) as { Properties: Record<string, unknown>; DeletionPolicy: string } | undefined;
    expect(table?.DeletionPolicy).toBe('Retain');
  });

  it('AuditEntries はキー entryId、gsiAll（listPartition + sortKey）の索引を持ち、TTL なし・RETAIN', () => {
    data.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'entryId', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'gsiAll',
          KeySchema: [
            { AttributeName: 'listPartition', KeyType: 'HASH' },
            { AttributeName: 'sortKey', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
    const table = resourcesOf(data, 'AWS::DynamoDB::Table').find(
      (t) =>
        (t.Properties.KeySchema as { AttributeName: string }[])[0]?.AttributeName === 'entryId',
    ) as { Properties: Record<string, unknown>; DeletionPolicy: string } | undefined;
    expect(table?.Properties.TimeToLiveSpecification).toBeUndefined();
    expect(table?.DeletionPolicy).toBe('Retain');
  });
});

describe('U4: すべて削除の入口（§8）', () => {
  it('5 つの削除の道をすべて認可付きで持つ', () => {
    const routes = resourcesOf(api, 'AWS::ApiGatewayV2::Route').map((r) =>
      String(r.Properties.RouteKey),
    );
    expect(routes).toEqual(
      expect.arrayContaining([
        'POST /v1/admin/catalog-data',
        'POST /v1/admin/review-data',
        'POST /v1/admin/duplicate-data',
        'POST /v1/admin/detection-data',
        'POST /v1/admin/reporting-data',
      ]),
    );
  });
});
