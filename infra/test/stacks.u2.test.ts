// U2 で足す AWS の構成の試験（aws-cdk-lib/assertions）。infrastructure-specification.md §2、
// scalability-design.md §1・§3、performance-design.md §2、security-design.md §1。
// stacks.u1.test.ts に続く。関数のまとめ（esbuild）は行わない。AWS には接続しない。
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { buildMonsterNote, type MonsterNoteStacks } from '../lib/monsternote';

const fixture = fileURLToPath(new URL('./fixtures/web', import.meta.url));

let stacks: MonsterNoteStacks;
const t: Record<string, Template> = {};

beforeAll(() => {
  const app = new App({
    outdir: fileURLToPath(new URL('../cdk.out/test-u2', import.meta.url)),
    context: { 'aws:cdk:bundling-stacks': [] },
  });
  stacks = buildMonsterNote(app, {
    hunterAssetPath: fixture,
    requesterAssetPath: fixture,
    alarmEmail: 'alarm@example.com',
  });
  for (const [name, stack] of Object.entries(stacks)) t[name] = Template.fromStack(stack as Stack);
});

const resourcesOf = (template: Template, type: string) =>
  Object.values(template.findResources(type)) as { Properties: Record<string, unknown> }[];

describe('Data（U2 で足す 5 つの表・S3 のライフサイクル）', () => {
  it('DetectionResults: キー photoId、TTL は expiresAt（結び付かなかった結果を自動で消す）', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'photoId', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('ReportFootprints: キー reportId、speciesDay の GSI で前後 3 日分を読める（BR8.3）', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'speciesDay',
          KeySchema: [{ AttributeName: 'speciesDay', KeyType: 'HASH' }],
        }),
      ]),
    });
  });

  it('DuplicateSuspicions: キー suspicionId、byReportId の GSI で報告ごとの一覧を読める（BR8.9）', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'suspicionId', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'byReportId',
          KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
        }),
      ]),
    });
  });

  it('Settings: キー settingKey（1 行だけ）', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'settingKey', KeyType: 'HASH' }],
    });
  });

  it('DetectionRateLimits: キー accountIdDate、TTL は ttl（NFR12.5。作成から 2 日で消える）', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'accountIdDate', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    });
  });

  it('U2 で足す 5 つの表もすべて RETAIN（消さずに残す）', () => {
    const tables = t.data!.findResources('AWS::DynamoDB::Table') as Record<
      string,
      { DeletionPolicy: string }
    >;
    const u2TableNames = [
      'DetectionResults',
      'ReportFootprints',
      'DuplicateSuspicions',
      'Settings',
      'DetectionRateLimits',
    ];
    const u2Tables = Object.entries(tables).filter(([logicalId]) =>
      u2TableNames.some((name) => logicalId.startsWith(`${name}Table`)),
    );
    expect(u2Tables.length).toBe(5);
    for (const [, table] of u2Tables) expect(table.DeletionPolicy).toBe('Retain');
  });

  it('写真の S3 は、作成から 1 日のライフサイクルルールを持つ（scalability-design §3）', () => {
    t.data!.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 1, Status: 'Enabled' })]),
      },
    });
  });
});

describe('Api（U2 で足す関数・道・知らせ）', () => {
  it('Reporting の時間切れは 9 秒以上（U1 の 8 秒から引き上げ。performance-design §2。U4で削除の入口を足すため15秒に統一）', () => {
    t.api!.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Timeout: 15,
      MemorySize: 256,
    });
  });

  it('Settings 関数: 128 MB・8 秒（U2 時点では API Gateway の道を持たない。U4 で管理者向けの道を足す）', () => {
    const functions = t.api!.findResources('AWS::Lambda::Function') as Record<
      string,
      { Properties: Record<string, unknown> }
    >;
    const [, settingsFn] =
      Object.entries(functions).find(([logicalId]) => logicalId.startsWith('SettingsFunction')) ??
      [];
    expect(settingsFn?.Properties.MemorySize).toBe(128);
    expect(settingsFn?.Properties.Timeout).toBe(8);
  });

  it('DuplicateDetection 関数: 256 MB・10 秒以上（U4で削除の入口を足すため15秒に統一）。GET /v1/duplicates/{reportId} を認可付きで持つ', () => {
    const fn = resourcesOf(t.api!, 'AWS::Lambda::Function').find(
      (f) =>
        JSON.stringify(f.Properties.Environment).includes('DUPLICATE_SUSPICIONS_TABLE') &&
        JSON.stringify(f.Properties.Environment).includes('REVIEW_DECISIONS_TABLE'),
    );
    expect(fn?.Properties.MemorySize).toBe(256);
    expect(fn?.Properties.Timeout).toBe(15);
    const route = resourcesOf(t.api!, 'AWS::ApiGatewayV2::Route').find(
      (r) => r.Properties.RouteKey === 'GET /v1/duplicates/{reportId}',
    );
    expect(route).toBeDefined();
    expect(route?.Properties.AuthorizationType).toBe('JWT');
  });

  it('GET /v1/report-settings は認可付きの道で、Reporting が担当する', () => {
    const route = resourcesOf(t.api!, 'AWS::ApiGatewayV2::Route').find(
      (r) => r.Properties.RouteKey === 'GET /v1/report-settings',
    );
    expect(route).toBeDefined();
    expect(route?.Properties.AuthorizationType).toBe('JWT');
  });

  it('Reporting の IAM は rekognition:DetectLabels を持ち、リソースは絞らない（NFR5.11）', () => {
    const policies = resourcesOf(t.api!, 'AWS::IAM::Policy');
    const reporting = policies.find((p) =>
      JSON.stringify(p.Properties.Roles).includes('ReportingFunction'),
    );
    const doc = reporting?.Properties.PolicyDocument as {
      Statement: { Action: string | string[]; Resource: string | string[] }[];
    };
    const rekognitionStatement = doc.Statement.find((s) =>
      (Array.isArray(s.Action) ? s.Action : [s.Action]).includes('rekognition:DetectLabels'),
    );
    expect(rekognitionStatement).toBeDefined();
    expect(rekognitionStatement?.Resource).toBe('*');
  });

  it('DuplicateDetection は ReviewDecisions を読み取りだけ（書き込みはしない。D-6）', () => {
    const policies = resourcesOf(t.api!, 'AWS::IAM::Policy');
    const fnPolicy = policies.find(
      (p) =>
        JSON.stringify(p.Properties.Roles).includes('DuplicateDetectionFunction') &&
        !JSON.stringify(p.Properties.Roles).includes('OnSaved') &&
        !JSON.stringify(p.Properties.Roles).includes('OnStatus'),
    );
    const doc = fnPolicy?.Properties.PolicyDocument as {
      Statement: { Action: string | string[]; Resource: unknown }[];
    };
    const reviewStatement = doc.Statement.find((s) =>
      JSON.stringify(s.Resource).includes('ReviewDecisionsTable'),
    );
    const actions = Array.isArray(reviewStatement?.Action)
      ? reviewStatement.Action
      : [reviewStatement?.Action];
    expect(actions.some((a) => String(a).startsWith('dynamodb:Get'))).toBe(true);
    expect(actions.some((a) => String(a).startsWith('dynamodb:PutItem'))).toBe(false);
  });

  it('report.saved のルールは DuplicateDetectionOnSaved も受け手に持つ', () => {
    t.api!.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { source: ['monsternote.reporting'], 'detail-type': ['report.saved'] },
      Targets: Match.arrayWith([
        Match.objectLike({
          Arn: Match.objectLike({
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('DuplicateDetectionOnSaved')]),
          }),
        }),
      ]),
    });
  });

  it('review.status-changed のルールは DuplicateDetectionOnStatus も受け手に持つ', () => {
    t.api!.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { source: ['monsternote.review'], 'detail-type': ['review.status-changed'] },
      Targets: Match.arrayWith([
        Match.objectLike({
          Arn: Match.objectLike({
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('DuplicateDetectionOnStatus')]),
          }),
        }),
      ]),
    });
  });

  it('常時課金のリソースは増えていない（project.md の Forbidden）', () => {
    const forbidden = /^AWS::(EC2|RDS|ElastiCache|ECS|WAFv2|Route53)::/;
    for (const template of Object.values(t)) {
      const types = Object.values(
        template.toJSON().Resources as Record<string, { Type: string }>,
      ).map((r) => r.Type);
      expect(types.filter((type) => forbidden.test(type))).toEqual([]);
    }
  });
});
