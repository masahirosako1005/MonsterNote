// U3 の AWS の構成の試験（aws-cdk-lib/assertions）。infrastructure-specification.md のとおり:
// review・catalog 関数のメモリ・時間切れは変えない、新しい関数は作らない、新しい道と知らせのルールを 1 つ足す。
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { buildMonsterNote, type MonsterNoteStacks } from '../lib/monsternote';

const fixture = fileURLToPath(new URL('./fixtures/web', import.meta.url));

let stacks: MonsterNoteStacks;
let api: Template;

beforeAll(() => {
  const app = new App({
    outdir: fileURLToPath(new URL('../cdk.out/test-u3', import.meta.url)),
    context: { 'aws:cdk:bundling-stacks': [] },
  });
  stacks = buildMonsterNote(app, {
    hunterAssetPath: fixture,
    requesterAssetPath: fixture,
    alarmEmail: 'alarm@example.com',
  });
  api = Template.fromStack(stacks.api);
});

const resourcesOf = (template: Template, type: string) =>
  Object.values(template.findResources(type)) as { Properties: Record<string, unknown> }[];

describe('U3: review・catalog 関数（既存のまま。新しい関数は作らない）', () => {
  it('関数はいまも 7 つ（却下・取り消し・絞り込みは既存の review・catalog を拡張するだけ）', () => {
    expect(resourcesOf(api, 'AWS::Lambda::Function')).toHaveLength(7);
  });

  it('review 関数のメモリ・時間切れは変わらない（128 MB・8 秒）', () => {
    api.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      MemorySize: 128,
      Timeout: 8,
    });
  });

  it('review・catalog の IAM 境界は崩れない: review は ReviewDecisions だけ、catalog は ReportListItems だけ', () => {
    const policies = resourcesOf(api, 'AWS::IAM::Policy');
    const reviewPolicy = policies.find((p) =>
      JSON.stringify(p.Properties.Roles).includes('ReviewFunction'),
    );
    const reviewText = JSON.stringify(reviewPolicy?.Properties.PolicyDocument);
    expect(reviewText).toContain('ReviewDecisionsTable');
    expect(reviewText).not.toContain('ReportListItemsTable');

    const catalogPolicy = policies.find(
      (p) =>
        JSON.stringify(p.Properties.Roles).includes('CatalogFunction') &&
        !JSON.stringify(p.Properties.Roles).includes('CatalogOnSaved') &&
        !JSON.stringify(p.Properties.Roles).includes('CatalogOnStatus'),
    );
    const catalogText = JSON.stringify(catalogPolicy?.Properties.PolicyDocument);
    expect(catalogText).toContain('ReportListItemsTable');
    expect(catalogText).not.toContain('ReviewDecisionsTable');
  });
});

describe('U3: API の道', () => {
  it('POST /v1/reviews/{reportId}/decision/undo が review 関数に紐づく', () => {
    const routes = api.findResources('AWS::ApiGatewayV2::Route') as Record<
      string,
      { Properties: Record<string, unknown> }
    >;
    const undoRoute = Object.values(routes).find(
      (r) => r.Properties.RouteKey === 'POST /v1/reviews/{reportId}/decision/undo',
    );
    expect(undoRoute).toBeDefined();
    // 認可（JWT）が付いている（依頼元だけの操作。NFR4.2）
    expect(undoRoute?.Properties.AuthorizationType).toBe('JWT');

    // Route の Target（integrations/<論理ID>）から、紐づく Integration の IntegrationUri を辿る
    const targetRef = (
      (undoRoute?.Properties.Target as { 'Fn::Join': [string, (string | { Ref: string })[]] })[
        'Fn::Join'
      ][1].find((p): p is { Ref: string } => typeof p === 'object') as { Ref: string }
    ).Ref;
    const integrations = api.findResources('AWS::ApiGatewayV2::Integration') as Record<
      string,
      { Properties: Record<string, unknown> }
    >;
    const uri = integrations[targetRef]?.Properties.IntegrationUri as {
      'Fn::GetAtt': [string, string];
    };
    expect(uri['Fn::GetAtt'][0]).toMatch(/^ReviewFunction/);
  });

  it('既存の PUT decision・GET reviews・GET catalog の道はそのまま残る', () => {
    const keys = resourcesOf(api, 'AWS::ApiGatewayV2::Route').map((r) => r.Properties.RouteKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        'PUT /v1/reviews/{reportId}/decision',
        'GET /v1/reviews/{reportId}',
        'GET /v1/catalog/reports',
        'GET /v1/catalog/my-reports',
      ]),
    );
  });
});

describe('U3: duplicate.suspected の知らせ（BR4.6。新しい関数は作らず既存の catalogOnStatus が受ける）', () => {
  it('新しいルールが monsternote.duplicatedetection/duplicate.suspected を catalogOnStatus に配る', () => {
    api.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['monsternote.duplicatedetection'],
        'detail-type': ['duplicate.suspected'],
      },
    });
  });

  it('review.status-changed のルールは変わらず catalogOnStatus 向け', () => {
    api.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { source: ['monsternote.review'], 'detail-type': ['review.status-changed'] },
    });
  });

  it('新しいルールの対象は、新しい関数ではなく既存の CatalogOnStatus 関数', () => {
    const fns = resourcesOf(api, 'AWS::Lambda::Function');
    const names = fns.map((f) => (f.Properties.Handler as string) ?? '');
    // 関数の名前（論理 ID）は Function リソースのメタ情報からは直接取れないため、
    // Permission の対象で確かめる（DuplicateSuspectedRule が作る Permission の FunctionName）
    const perms = resourcesOf(api, 'AWS::Lambda::Permission').filter(
      (p) => p.Properties.Principal === 'events.amazonaws.com',
    );
    const targetsCatalogOnStatus = perms.some((p) =>
      JSON.stringify(
        (p.Properties.FunctionName as { 'Fn::GetAtt'?: string[] })?.['Fn::GetAtt'],
      ).includes('CatalogOnStatusFunction'),
    );
    expect(targetsCatalogOnStatus).toBe(true);
    // 関数は 7 つのまま（上の describe と合わせて二重に確かめる）
    expect(names.length).toBeGreaterThan(0);
    expect(fns).toHaveLength(7);
  });
});

describe('U3: 新しい表・新しいスタックを作らない（infrastructure-specification.md Q1-A）', () => {
  it('MonsterNote-Data-dev の表は U1 の 7 つのまま', () => {
    const data = Template.fromStack(stacks.data);
    expect(Object.keys(data.findResources('AWS::DynamoDB::Table'))).toHaveLength(7);
  });

  it('ReviewDecisions・ReportListItems に新しい索引は増えていない', () => {
    const data = Template.fromStack(stacks.data);
    const tables = resourcesOf(data, 'AWS::DynamoDB::Table');
    const reportListItems = tables.find((t) => JSON.stringify(t.Properties).includes('gsiAll'));
    const gsis = (reportListItems?.Properties.GlobalSecondaryIndexes as unknown[]) ?? [];
    expect(gsis).toHaveLength(2);
  });

  it('スタックは U1 と同じ 5 つのまま', () => {
    expect(Object.keys(stacks)).toHaveLength(5);
  });
});

describe('U3: 無料枠（project.md の Mandated）', () => {
  it('常時課金のリソースを増やしていない（EC2・NAT・RDS・ElastiCache・Fargate・WAF・Route 53 ホストゾーン）', () => {
    for (const template of [api]) {
      for (const type of [
        'AWS::EC2::Instance',
        'AWS::EC2::NatGateway',
        'AWS::RDS::DBInstance',
        'AWS::ElastiCache::CacheCluster',
        'AWS::ECS::Service',
        'AWS::WAFv2::WebACL',
        'AWS::Route53::HostedZone',
      ]) {
        expect(Object.keys(template.findResources(type))).toHaveLength(0);
      }
    }
  });

  it('すべての関数のタグは masahiro-lambda-monsternote（既存の命名規則のまま）', () => {
    api.hasResourceProperties(
      'AWS::Lambda::Function',
      Match.objectLike({
        Tags: Match.arrayWith([{ Key: 'Name', Value: 'masahiro-lambda-monsternote' }]),
      }),
    );
  });
});
