// AWS の構成（CDK）の試験（aws-cdk-lib/assertions）。infrastructure-specification・monitoring-design・NFR1.2・NFR4・NFR5・NFR11・NFR12。
// 関数のまとめ（esbuild）は試験では行わない（aws:cdk:bundling-stacks を空にする）。AWS には接続しない。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { App, CfnResource, Stack, TagManager } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { buildMonsterNote, type MonsterNoteStacks } from '../lib/monsternote';

const fixture = fileURLToPath(new URL('./fixtures/web', import.meta.url));

let app: App;
let stacks: MonsterNoteStacks;
const t: Record<string, Template> = {};

beforeAll(() => {
  // 合成の出力はプロジェクトの中（.gitignore した cdk.out）に置く
  app = new App({
    outdir: fileURLToPath(new URL('../cdk.out/test', import.meta.url)),
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

describe('Auth（Cognito）', () => {
  it('自分での登録はできず、ユーザープールは消さずに残す（RETAIN）', () => {
    t.auth!.hasResource('AWS::Cognito::UserPool', {
      Properties: Match.objectLike({ AdminCreateUserConfig: { AllowAdminCreateUserOnly: true } }),
      DeletionPolicy: 'Retain',
    });
  });

  it('パスワードは 8 文字以上・小文字と数字（大文字・記号は求めない）', () => {
    t.auth!.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireUppercase: false,
          RequireSymbols: false,
        }),
      },
    });
  });

  it('アプリのクライアント: 秘密の値なし、証明 1 時間・出し直し 30 日、USER_PASSWORD_AUTH と REFRESH_TOKEN_AUTH', () => {
    t.auth!.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 43200,
      TokenValidityUnits: { AccessToken: 'minutes', IdToken: 'minutes', RefreshToken: 'minutes' },
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH']),
      EnableTokenRevocation: true,
    });
  });

  it('リフレッシュトークンの更新（rotation）を有効にし、再利用の猶予は 60 秒', () => {
    t.auth!.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      RefreshTokenRotation: { Feature: 'ENABLED', RetryGracePeriodSeconds: 60 },
    });
  });

  // rotation を有効にすると ALLOW_REFRESH_TOKEN_AUTH は書けない（Cognito が 400 を返す）。
  // 書かなくても更新はできる（rotation が有効なとき、更新は暗黙に許可される）。
  it('rotation が有効なため ALLOW_REFRESH_TOKEN_AUTH は入れない', () => {
    const flows = resourcesOf(t.auth!, 'AWS::Cognito::UserPoolClient').map(
      (c) => c.Properties.ExplicitAuthFlows as string[],
    );
    expect(flows).toHaveLength(1);
    expect(flows[0]).not.toContain('ALLOW_REFRESH_TOKEN_AUTH');
  });

  it('グループは hunter・requester・admin の 3 つ', () => {
    const groups = resourcesOf(t.auth!, 'AWS::Cognito::UserPoolGroup').map(
      (g) => g.Properties.GroupName,
    );
    expect(groups.sort()).toEqual(['admin', 'hunter', 'requester']);
  });
});

describe('Web（画面の配信）', () => {
  it('画面の S3 は 2 つで、公開しない・SSE-S3', () => {
    const buckets = resourcesOf(t.web!, 'AWS::S3::Bucket');
    expect(buckets).toHaveLength(2);
    for (const b of buckets) {
      expect(b.Properties.PublicAccessBlockConfiguration).toEqual({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
      expect(JSON.stringify(b.Properties.BucketEncryption)).toContain('AES256');
    }
  });

  it('CloudFront は 2 つで、OAC で S3 を読み、HTTP を HTTPS に転送し、SPA のため 403/404 を index.html にする', () => {
    t.web!.resourceCountIs('AWS::CloudFront::Distribution', 2);
    t.web!.resourceCountIs('AWS::CloudFront::OriginAccessControl', 2);
    t.web!.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
        }),
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
        ]),
        PriceClass: 'PriceClass_200',
      }),
    });
  });

  it('index.html と config.json はキャッシュしない', () => {
    t.web!.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: '/index.html' }),
          Match.objectLike({ PathPattern: '/config.json' }),
        ]),
      }),
    });
  });

  it('セキュリティのヘッダー（CSP・HSTS・nosniff・DENY・Referrer-Policy）', () => {
    t.web!.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: {
            ContentSecurityPolicy: Match.stringLikeRegexp(
              "script-src 'self';.*frame-ancestors 'none'",
            ),
            Override: true,
          },
          StrictTransportSecurity: Match.objectLike({
            AccessControlMaxAgeSec: 31536000,
            IncludeSubdomains: true,
          }),
          ContentTypeOptions: { Override: true },
          FrameOptions: { FrameOption: 'DENY', Override: true },
          ReferrerPolicy: { ReferrerPolicy: 'strict-origin-when-cross-origin', Override: true },
        }),
      }),
    });
  });
});

describe('Data（DynamoDB と写真の S3）', () => {
  it('表は 12 個（U1 の 7 つ + U2 の 5 つ）で、すべてオンデマンド・消さずに残す（RETAIN）', () => {
    const tables = t.data!.findResources('AWS::DynamoDB::Table');
    expect(Object.keys(tables)).toHaveLength(12);
    for (const table of Object.values(tables) as {
      Properties: Record<string, unknown>;
      DeletionPolicy: string;
    }[]) {
      expect(table.Properties.BillingMode).toBe('PAY_PER_REQUEST');
      expect(table.DeletionPolicy).toBe('Retain');
    }
  });

  it('表のキー（U1: accountId・reportId・submissionKey・photoId・consumerEventId、U2 の 5 つを含む）', () => {
    const keys = resourcesOf(t.data!, 'AWS::DynamoDB::Table').map(
      (table) => (table.Properties.KeySchema as { AttributeName: string }[])[0]?.AttributeName,
    );
    expect(keys.sort()).toEqual(
      [
        'accountId',
        'accountIdDate',
        'consumerEventId',
        'photoId',
        'photoId',
        'reportId',
        'reportId',
        'reportId',
        'reportId',
        'settingKey',
        'submissionKey',
        'suspicionId',
      ].sort(),
    );
  });

  it('Accounts に loginId の索引、ReportListItems に gsiAll と gsiHunter の索引', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'accountId', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: 'loginId',
          KeySchema: [{ AttributeName: 'loginId', KeyType: 'HASH' }],
        }),
      ],
    });
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'gsiAll',
          KeySchema: [
            { AttributeName: 'listPartition', KeyType: 'HASH' },
            { AttributeName: 'sortKey', KeyType: 'RANGE' },
          ],
        }),
        Match.objectLike({
          IndexName: 'gsiHunter',
          KeySchema: [
            { AttributeName: 'hunterAccountId', KeyType: 'HASH' },
            { AttributeName: 'sortKey', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  it('ProcessedEvents は TTL（expiresAt）で自動で消える', () => {
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'consumerEventId', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    });
  });

  it('写真の S3 は公開しない・SSE-S3・RETAIN。CORS は POST と GET を 2 つの画面の Origin からだけ許す', () => {
    t.data!.hasResource('AWS::S3::Bucket', {
      Properties: Match.objectLike({
        PublicAccessBlockConfiguration: Match.objectLike({
          BlockPublicAcls: true,
          RestrictPublicBuckets: true,
        }),
        CorsConfiguration: {
          CorsRules: [
            Match.objectLike({
              AllowedMethods: ['POST', 'GET'],
              AllowedOrigins: Match.arrayEquals([Match.anyValue(), Match.anyValue()]),
            }),
          ],
        },
      }),
      DeletionPolicy: 'Retain',
    });
  });
});

describe('Api（HTTP API・関数・知らせ・監視）', () => {
  it('JWT オーソライザーは Cognito のユーザープールとクライアントを使う', () => {
    t.api!.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
    });
  });

  it('証明を確かめない道は POST /v1/session と POST /v1/session/refresh だけ。/internal の道はない', () => {
    const routes = resourcesOf(t.api!, 'AWS::ApiGatewayV2::Route');
    const open = routes
      .filter((r) => (r.Properties.AuthorizationType ?? 'NONE') === 'NONE')
      .map((r) => r.Properties.RouteKey);
    expect(open.sort()).toEqual(['POST /v1/session', 'POST /v1/session/refresh']);
    const keys = routes.map((r) => String(r.Properties.RouteKey));
    // U1 の 11 個 + U2 の 2 個（GET /v1/report-settings・GET /v1/duplicates/{reportId}）
    // + U3 の 1 個（POST /v1/reviews/{reportId}/decision/undo）
    expect(keys).toHaveLength(14);
    expect(keys).toEqual(
      expect.arrayContaining([
        'DELETE /v1/session',
        'PUT /v1/reviews/{reportId}/decision',
        'GET /v1/report-settings',
        'GET /v1/duplicates/{reportId}',
      ]),
    );
    expect(keys.some((k) => k.includes('/internal'))).toBe(false);
  });

  it('既定のステージの流量は毎秒 10・瞬間 20、アクセスログは 14 日', () => {
    t.api!.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      DefaultRouteSettings: { ThrottlingBurstLimit: 20, ThrottlingRateLimit: 10 },
      AccessLogSettings: Match.objectLike({ DestinationArn: Match.anyValue() }),
    });
  });

  it('CORS は 2 つの画面の Origin と GET・POST・PUT・DELETE、Authorization・Content-Type', () => {
    t.api!.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowMethods: Match.arrayWith(['GET', 'POST', 'PUT', 'DELETE']),
        AllowHeaders: Match.arrayWith(['authorization', 'content-type']),
        AllowOrigins: Match.arrayEquals([Match.anyValue(), Match.anyValue()]),
      }),
    });
  });

  it('関数は 11 個（U1 の 7 つ + U2 の 4 つ）: Arm・Node.js 22・メモリ 128〜256 MB・時間切れ 8〜10 秒', () => {
    const fns = resourcesOf(t.api!, 'AWS::Lambda::Function');
    expect(fns).toHaveLength(11);
    for (const fn of fns) {
      expect(fn.Properties.Architectures).toEqual(['arm64']);
      expect(fn.Properties.Runtime).toBe('nodejs22.x');
      expect(fn.Properties.MemorySize as number).toBeGreaterThanOrEqual(128);
      expect(fn.Properties.MemorySize as number).toBeLessThanOrEqual(256);
      // U2（performance-design §2）: Reporting は 9 秒に引き上げた
      expect([8, 9, 10]).toContain(fn.Properties.Timeout);
    }
    // 256 MB: Reporting・DuplicateDetection・DuplicateDetectionOnSaved
    expect(fns.filter((f) => f.Properties.MemorySize === 256)).toHaveLength(3);
    expect(fns.filter((f) => f.Properties.Timeout === 9)).toHaveLength(1);
    expect(fns.filter((f) => f.Properties.Timeout === 10)).toHaveLength(6);
  });

  it('すべての関数（画面の配置の関数も）のメモリは 128〜256 MB、ロググループは 14 日以内', () => {
    for (const template of Object.values(t)) {
      for (const fn of resourcesOf(template, 'AWS::Lambda::Function')) {
        expect(fn.Properties.MemorySize as number).toBeGreaterThanOrEqual(128);
        expect(fn.Properties.MemorySize as number).toBeLessThanOrEqual(256);
      }
      for (const lg of resourcesOf(template, 'AWS::Logs::LogGroup')) {
        expect(lg.Properties.RetentionInDays as number).toBeLessThanOrEqual(14);
      }
    }
    expect(resourcesOf(t.api!, 'AWS::Logs::LogGroup').length).toBeGreaterThanOrEqual(8);
  });

  it('関数の IAM は自分の表だけ: Reporting は Accounts と Review の表を使えず、Accounts・Settings・DuplicateDetection の関数を呼べる（U2）', () => {
    const policies = resourcesOf(t.api!, 'AWS::IAM::Policy');
    const policyOf = (fnLogicalName: string) =>
      policies.find((p) => JSON.stringify(p.Properties.Roles).includes(fnLogicalName));
    const reporting = policyOf('ReportingFunction');
    const text = JSON.stringify(reporting?.Properties.PolicyDocument);
    expect(text).toContain('PhotosTable');
    expect(text).toContain('ReportsTable');
    expect(text).toContain('SubmissionKeysTable');
    expect(text).toContain('DetectionResultsTable');
    expect(text).toContain('DetectionRateLimitsTable');
    expect(text).not.toContain('AccountsTable');
    expect(text).not.toContain('ReviewDecisionsTable');
    expect(text).toContain('lambda:InvokeFunction');
    expect(text).toContain('rekognition:DetectLabels');

    // U2: DuplicateDetection・DuplicateDetectionOnSaved も Settings 関数を呼べる（ADR-011）
    for (const fnName of ['DuplicateDetectionFunction', 'DuplicateDetectionOnSavedFunction']) {
      const policy = policyOf(fnName);
      expect(JSON.stringify(policy?.Properties.PolicyDocument)).toContain('lambda:InvokeFunction');
    }

    // それ以外の関数（画面向けの道・一覧・知らせの受け手の一部）は他の関数を呼ばない
    const invokerNames = [
      'ReportingFunction',
      'DuplicateDetectionFunction',
      'DuplicateDetectionOnSavedFunction',
    ];
    const others = policies.filter(
      (p) => !invokerNames.some((name) => JSON.stringify(p.Properties.Roles).includes(name)),
    );
    expect(
      others.some((p) =>
        JSON.stringify(p.Properties.PolicyDocument).includes('lambda:InvokeFunction'),
      ),
    ).toBe(false);
  });

  it('EventBridge: 独自のバスと、送り手（source）で絞った 2 つのルール（U2 で DuplicateDetection も受け手に加わる）', () => {
    t.api!.hasResourceProperties('AWS::Events::EventBus', { Name: 'monsternote-dev' });
    t.api!.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { source: ['monsternote.reporting'], 'detail-type': ['report.saved'] },
      // U1 の 2 つ（ReviewOnSaved・CatalogOnSaved）+ U2 の DuplicateDetectionOnSaved
      Targets: Match.arrayEquals([Match.anyValue(), Match.anyValue(), Match.anyValue()]),
    });
    t.api!.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { source: ['monsternote.review'], 'detail-type': ['review.status-changed'] },
      // U1 の CatalogOnStatus + U2 の DuplicateDetectionOnStatus
      Targets: Match.arrayEquals([Match.anyValue(), Match.anyValue()]),
    });
    // 受け手の関数は EventBridge からの呼び出しだけを許す
    // U1 の 3 + U2 の 2（DuplicateDetectionOnSaved・DuplicateDetectionOnStatus）
    // + U3 の 1（DuplicateSuspectedRule→catalogOnStatus。stacks.u3.test.ts で詳しく確認する）
    const perms = resourcesOf(t.api!, 'AWS::Lambda::Permission').filter(
      (p) => p.Properties.Principal === 'events.amazonaws.com',
    );
    expect(perms).toHaveLength(6);
  });

  it('アラームは 2 つ: 5xx の割合（計算式・データがなければ正常）と関数のエラー。宛先は SNS', () => {
    t.api!.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'masahiro-cloudwatch-monsternote-api-5xx',
      Threshold: 5,
      EvaluationPeriods: 1,
      ComparisonOperator: 'GreaterThanThreshold',
      TreatMissingData: 'notBreaching',
      Metrics: Match.arrayWith([
        Match.objectLike({ Expression: 'IF(cnt >= 5, e5xx / cnt * 100, 0)' }),
      ]),
    });
    t.api!.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'masahiro-cloudwatch-monsternote-lambda-errors',
      Threshold: 3,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      TreatMissingData: 'notBreaching',
    });
    t.api!.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    t.api!.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'masahiro-sns-monsternote-alarm',
    });
    t.api!.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'alarm@example.com',
    });
  });
});

describe('WebContent（画面のファイルと config.json）', () => {
  it('2 つの画面の S3 に、画面のファイルと実行時の設定 config.json を置き、キャッシュを無効化する', () => {
    const deployments = resourcesOf(t.webContent!, 'Custom::CDKBucketDeployment');
    expect(deployments).toHaveLength(2);
    for (const d of deployments) {
      expect((d.Properties.SourceObjectKeys as unknown[]).length).toBe(2);
      expect(d.Properties.DistributionPaths).toEqual(['/*']);
      // config.json の値（API の URL・ユーザープールの ID・クライアントの ID・写真の S3）はデプロイのときに埋まる
      const markers = (d.Properties.SourceMarkers as Record<string, unknown>[])[1] ?? {};
      expect(Object.keys(markers)).toHaveLength(4);
    }
    // config.json の中身（キー）は CDK が作るファイルにある
    const dir = app.synth().directory;
    const configFiles = readdirSync(dir)
      .map((entry) => join(dir, entry, 'config.json'))
      .filter((path) => existsSync(path));
    expect(configFiles).toHaveLength(1);
    const config = JSON.parse(readFileSync(configFiles[0]!, 'utf8')) as Record<string, string>;
    expect(Object.keys(config).sort()).toEqual([
      'apiBaseUrl',
      'photoBucketUrl',
      'userPoolClientId',
      'userPoolId',
    ]);
  });
});

describe('全体', () => {
  it('タグを付けられるリソースすべてに Name=masahiro-<サービス>-monsternote と Project=monsternote', () => {
    const taggable = app.node
      .findAll()
      .filter((c): c is CfnResource => c instanceof CfnResource && TagManager.isTaggable(c));
    expect(taggable.length).toBeGreaterThan(20);
    for (const resource of taggable) {
      const tags = (resource as unknown as { tags: TagManager }).tags.tagValues();
      expect(tags.Name, resource.cfnResourceType).toMatch(/^masahiro-[a-z0-9]+-monsternote$/);
      expect(tags.Project).toBe('monsternote');
    }
    t.api!.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([{ Key: 'Name', Value: 'masahiro-lambda-monsternote' }]),
    });
    t.data!.hasResourceProperties('AWS::DynamoDB::Table', {
      Tags: Match.arrayWith([{ Key: 'Name', Value: 'masahiro-dynamodb-monsternote' }]),
    });
    t.data!.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([{ Key: 'Name', Value: 'masahiro-s3-monsternote' }]),
    });
  });

  it('常時課金のリソース（EC2・VPC・NAT・RDS・ElastiCache・ECS・WAF・Route 53 のホストゾーン）がない', () => {
    const forbidden = /^AWS::(EC2|RDS|ElastiCache|ECS|WAFv2|Route53)::/;
    for (const template of Object.values(t)) {
      const types = Object.values(
        template.toJSON().Resources as Record<string, { Type: string }>,
      ).map((r) => r.Type);
      expect(types.filter((type) => forbidden.test(type))).toEqual([]);
    }
  });

  it('スタックの依存は Auth → Web → Data → Api → WebContent の一方向', () => {
    expect(stacks.web.dependencies).toContain(stacks.auth);
    expect(stacks.data.dependencies).toContain(stacks.web);
    expect(stacks.api.dependencies).toContain(stacks.data);
    expect(stacks.webContent.dependencies).toContain(stacks.api);
    expect(stacks.auth.dependencies).toEqual([]);
    const ordered = [stacks.auth, stacks.web, stacks.data, stacks.api, stacks.webContent];
    expect(ordered.map((s) => s.stackName)).toEqual([
      'MonsterNote-Auth-dev',
      'MonsterNote-Web-dev',
      'MonsterNote-Data-dev',
      'MonsterNote-Api-dev',
      'MonsterNote-WebContent-dev',
    ]);
  });

  it('bootstrap は MonsterNote 専用の qualifier（mnote）を使う', () => {
    const params = t.auth!.toJSON().Parameters as Record<string, { Default: string }>;
    expect(params.BootstrapVersion?.Default).toBe('/cdk-bootstrap/mnote/version');
  });
});
