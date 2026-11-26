// MonsterNote-Api-dev: HTTP API（JWT オーソライザー・流量・CORS）、関数 12 個、EventBridge、アラーム（API 5xx 1 つ＋関数エラー、CloudWatch の 10 指標上限のため組分け）と SNS。
// infrastructure-specification 2、monitoring-design、security-design NFR4.2〜NFR4.4、reliability-design。
import { fileURLToPath } from 'node:url';
import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import {
  CfnStage,
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpStage,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  Alarm,
  ComparisonOperator,
  MathExpression,
  Metric,
  TreatMissingData,
  type IMetric,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { RemovalPolicy } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { AuthStack } from './auth-stack';
import type { DataStack } from './data-stack';

const HANDLERS_DIR = fileURLToPath(new URL('../../backend/src/handlers/', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const EVENT_BUS_NAME = 'monsternote-dev';

export interface ApiStackProps extends StackProps {
  auth: AuthStack;
  data: DataStack;
  webOrigins: string[];
  /** アラームのメールの宛先（-c alarmEmail=... で渡す。リポジトリに書かない） */
  alarmEmail?: string;
}

export class ApiStack extends Stack {
  readonly httpApi: HttpApi;
  readonly functions: Record<string, NodejsFunction>;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { tables, photoBucket } = props.data;

    const fn = (
      name: string,
      entry: string,
      options: { memory?: number; timeoutSec: number; env: Record<string, string> },
    ) =>
      new NodejsFunction(this, `${name}Function`, {
        entry: `${HANDLERS_DIR}${entry}.ts`,
        handler: 'handler',
        projectRoot: REPO_ROOT,
        depsLockFilePath: `${REPO_ROOT}package-lock.json`,
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: options.memory ?? 128,
        timeout: Duration.seconds(options.timeoutSec),
        environment: options.env,
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        bundling: { minify: true, sourceMap: false, target: 'node22' },
      });

    const bus = new EventBus(this, 'EventBus', { eventBusName: EVENT_BUS_NAME });

    // API の関数（時間切れ 8 秒。reliability-design の時間の予算）
    const accounts = fn('Accounts', 'accounts', {
      timeoutSec: 8,
      env: {
        ACCOUNTS_TABLE: tables.accounts.tableName,
        ADMIN_COUNTER_TABLE: tables.adminCounter.tableName,
        USER_POOL_CLIENT_ID: props.auth.userPoolClient.userPoolClientId,
        USER_POOL_ID: props.auth.userPool.userPoolId,
        // U4（BR12.5）: アカウントの作成・再設定・無効化／有効化の操作の記録（audit.recorded）を送るため
        EVENT_BUS_NAME: bus.eventBusName,
      },
    });
    // U4: 操作の記録の受け手と一覧（GET /v1/admin/audit-entries）
    const auditLog = fn('AuditLog', 'audit-log', {
      timeoutSec: 10,
      env: {
        AUDIT_ENTRIES_TABLE: tables.auditEntries.tableName,
        // U4（BR11.4）: 仮のパスワードのままの確認（caller-status）のため、Accounts関数を呼ぶ
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
      },
    });
    // U2: 設定の読み出し。U4でPUT /v1/admin/settings（書き込み）も足す
    const settings = fn('Settings', 'settings', {
      timeoutSec: 8,
      env: {
        SETTINGS_TABLE: tables.settings.tableName,
        EVENT_BUS_NAME: bus.eventBusName,
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
      },
    });
    // U2: 重複の判定。送信前のその場の呼び出し（C9）と report.saved の知らせの両方から呼ばれる
    // U4: 時間切れを15秒に統一（削除の入口を足すため。performance-design.md §3）
    const duplicateDetection = fn('DuplicateDetection', 'duplicate-detection', {
      memory: 256,
      timeoutSec: 15,
      env: {
        REPORT_FOOTPRINTS_TABLE: tables.reportFootprints.tableName,
        DUPLICATE_SUSPICIONS_TABLE: tables.duplicateSuspicions.tableName,
        REVIEW_DECISIONS_TABLE: tables.reviewDecisions.tableName,
        SETTINGS_FUNCTION_NAME: settings.functionName,
        EVENT_BUS_NAME: bus.eventBusName,
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
      },
    });
    const reporting = fn('Reporting', 'reporting', {
      memory: 256,
      // U2（performance-design §2）: 8 秒 → 9 秒。U4: 削除の入口を足すため 15 秒に統一
      timeoutSec: 15,
      env: {
        PHOTOS_TABLE: tables.photos.tableName,
        REPORTS_TABLE: tables.reports.tableName,
        SUBMISSION_KEYS_TABLE: tables.submissionKeys.tableName,
        DETECTION_RESULTS_TABLE: tables.detectionResults.tableName,
        DETECTION_RATE_LIMITS_TABLE: tables.detectionRateLimits.tableName,
        PHOTO_BUCKET: photoBucket.bucketName,
        EVENT_BUS_NAME: bus.eventBusName,
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
        SETTINGS_FUNCTION_NAME: settings.functionName,
        DUPLICATE_DETECTION_FUNCTION_NAME: duplicateDetection.functionName,
      },
    });
    // U4: 時間切れを15秒に統一（削除の入口を足すため）
    const review = fn('Review', 'review', {
      timeoutSec: 15,
      env: {
        REVIEW_DECISIONS_TABLE: tables.reviewDecisions.tableName,
        EVENT_BUS_NAME: bus.eventBusName,
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
      },
    });
    // U4: 時間切れを15秒に統一（削除の入口を足すため）。削除の記録のためEVENT_BUS_NAMEも足す
    const catalog = fn('Catalog', 'catalog', {
      timeoutSec: 15,
      env: {
        REPORT_LIST_ITEMS_TABLE: tables.reportListItems.tableName,
        EVENT_BUS_NAME: bus.eventBusName,
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
      },
    });
    // 知らせの受け手（時間切れ 10 秒）
    const reviewOnSaved = fn('ReviewOnSaved', 'review-on-saved', {
      timeoutSec: 10,
      env: {
        REVIEW_DECISIONS_TABLE: tables.reviewDecisions.tableName,
        PROCESSED_EVENTS_TABLE: tables.processedEvents.tableName,
      },
    });
    const catalogOnSaved = fn('CatalogOnSaved', 'catalog-on-saved', {
      timeoutSec: 10,
      env: {
        REPORT_LIST_ITEMS_TABLE: tables.reportListItems.tableName,
        PROCESSED_EVENTS_TABLE: tables.processedEvents.tableName,
      },
    });
    const catalogOnStatus = fn('CatalogOnStatus', 'catalog-on-status', {
      timeoutSec: 10,
      env: {
        REPORT_LIST_ITEMS_TABLE: tables.reportListItems.tableName,
        PROCESSED_EVENTS_TABLE: tables.processedEvents.tableName,
      },
    });
    // U2: report.saved を受けて保存後に再判定する（ADR-003）
    const duplicateDetectionOnSaved = fn(
      'DuplicateDetectionOnSaved',
      'duplicate-detection-on-saved',
      {
        memory: 256,
        timeoutSec: 10,
        env: {
          REPORT_FOOTPRINTS_TABLE: tables.reportFootprints.tableName,
          DUPLICATE_SUSPICIONS_TABLE: tables.duplicateSuspicions.tableName,
          PROCESSED_EVENTS_TABLE: tables.processedEvents.tableName,
          EVENT_BUS_NAME: bus.eventBusName,
          SETTINGS_FUNCTION_NAME: settings.functionName,
        },
      },
    );
    // U2（Assumptions 参照）: review.status-changed を受けて索引の active を出し入れする（BR8.7・BR8.11）
    const duplicateDetectionOnStatus = fn(
      'DuplicateDetectionOnStatus',
      'duplicate-detection-on-status',
      {
        timeoutSec: 10,
        env: {
          REPORT_FOOTPRINTS_TABLE: tables.reportFootprints.tableName,
          PROCESSED_EVENTS_TABLE: tables.processedEvents.tableName,
        },
      },
    );
    this.functions = {
      accounts,
      auditLog,
      reporting,
      review,
      catalog,
      settings,
      duplicateDetection,
      reviewOnSaved,
      catalogOnSaved,
      catalogOnStatus,
      duplicateDetectionOnSaved,
      duplicateDetectionOnStatus,
    };

    // 関数ごとの IAM: 自分の表だけ（logical-components の分け方）
    tables.accounts.grantReadWriteData(accounts);
    tables.adminCounter.grantReadWriteData(accounts);
    // U4（BR12.5）: アカウントの作成・再設定・無効化／有効化の操作の記録を送る
    bus.grantPutEventsTo(accounts);
    tables.auditEntries.grantReadWriteData(auditLog);
    bus.grantPutEventsTo(auditLog);
    // U4（BR11.2・BR11.3・BR11.9）: 最小権限。AdminCreateUser・AdminSetUserPassword・AdminAddUserToGroup
    // だけを許す（AdminUpdateUserAttributes・AdminDisableUser は付与しない。無効化はDynamoDB側だけで行う）
    accounts.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
        ],
        resources: [props.auth.userPool.userPoolArn],
      }),
    );
    for (const t of [tables.photos, tables.reports, tables.submissionKeys])
      t.grantReadWriteData(reporting);
    tables.detectionResults.grantReadWriteData(reporting);
    tables.detectionRateLimits.grantReadWriteData(reporting);
    photoBucket.grantPut(reporting);
    photoBucket.grantRead(reporting);
    photoBucket.grantDelete(reporting);
    bus.grantPutEventsTo(reporting);
    // 部品の間の直接の呼び出し C10: Reporting だけが Accounts の関数を呼べる（NFR4.4）
    accounts.grantInvoke(reporting);
    // U4（BR11.4）: 仮のパスワードのままかの確認（caller-status）のため、
    // review・catalog・duplicate-detection・settings・audit-log もAccounts関数を呼べる
    // （reporting はC10の呼び出しですでに許可済み）
    for (const caller of [review, catalog, duplicateDetection, settings, auditLog]) {
      accounts.grantInvoke(caller);
    }
    // U2: Rekognition の DetectLabels だけを許す（リソースを絞れないため「*」。NFR5.11）
    reporting.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['rekognition:DetectLabels'],
        resources: ['*'],
      }),
    );
    // U2: Reporting・DuplicateDetection はどちらも Settings 関数を呼ぶ側（ADR-011）
    settings.grantInvoke(reporting);
    settings.grantInvoke(duplicateDetection);
    // U2: 送信前の重複の問い合わせ（C9）は Reporting から DuplicateDetection への直接の呼び出し
    duplicateDetection.grantInvoke(reporting);
    // U4: PUT /v1/admin/settings（書き込み）を足したため読み書きに引き上げる
    tables.settings.grantReadWriteData(settings);
    tables.reportFootprints.grantReadWriteData(duplicateDetection);
    tables.duplicateSuspicions.grantReadWriteData(duplicateDetection);
    // U2（D-6・BR8.8）: GET /v1/duplicates/{reportId} が相手の報告の状態を読む
    tables.reviewDecisions.grantReadData(duplicateDetection);
    tables.reportFootprints.grantReadWriteData(duplicateDetectionOnSaved);
    tables.duplicateSuspicions.grantReadWriteData(duplicateDetectionOnSaved);
    bus.grantPutEventsTo(duplicateDetectionOnSaved);
    settings.grantInvoke(duplicateDetectionOnSaved);
    tables.reportFootprints.grantReadWriteData(duplicateDetectionOnStatus);
    tables.reviewDecisions.grantReadWriteData(review);
    bus.grantPutEventsTo(review);
    // U4: すべて削除の入口（BatchWriteItem）を足したため読み書きに引き上げる
    tables.reportListItems.grantReadWriteData(catalog);
    tables.reviewDecisions.grantReadWriteData(reviewOnSaved);
    for (const consumer of [catalogOnSaved, catalogOnStatus])
      tables.reportListItems.grantReadWriteData(consumer);
    for (const consumer of [
      reviewOnSaved,
      catalogOnSaved,
      catalogOnStatus,
      duplicateDetectionOnSaved,
      duplicateDetectionOnStatus,
    ]) {
      tables.processedEvents.grantReadWriteData(consumer);
    }

    // 知らせ: 送り手（source）で絞り、受け手の関数に配る。受け手は EventBridge からだけ呼べる
    new Rule(this, 'ReportSavedRule', {
      eventBus: bus,
      eventPattern: { source: ['monsternote.reporting'], detailType: ['report.saved'] },
      targets: [
        new LambdaFunction(reviewOnSaved),
        new LambdaFunction(catalogOnSaved),
        // U2: 保存後の再判定（ADR-003）
        new LambdaFunction(duplicateDetectionOnSaved),
      ],
    });
    new Rule(this, 'StatusChangedRule', {
      eventBus: bus,
      eventPattern: { source: ['monsternote.review'], detailType: ['review.status-changed'] },
      // U2: 却下・取り消しで索引の active を出し入れする（BR8.7・BR8.11。Assumptions 参照）
      targets: [
        new LambdaFunction(catalogOnStatus),
        new LambdaFunction(duplicateDetectionOnStatus),
      ],
    });
    // U3 BR4.6・UC19: 重複の疑いの印（送り手は U2 の DuplicateDetection。C14）。
    // 新しい関数は作らない（infrastructure-specification.md）。既存の catalogOnStatus が受け、
    // 関数の中で envelope.type を見て振り分ける（handlers/consumers.ts）
    new Rule(this, 'DuplicateSuspectedRule', {
      eventBus: bus,
      eventPattern: {
        source: ['monsternote.duplicatedetection'],
        detailType: ['duplicate.suspected'],
      },
      targets: [new LambdaFunction(catalogOnStatus)],
    });
    // U4（BR12.5・NFR14.5）: 操作の記録。送り手は各部品（Accounts・Review・ReportCatalog・Reporting・
    // DuplicateDetection・Settings）。detailTypeだけで絞り、送り手は区別しない
    new Rule(this, 'AuditRecordedRule', {
      eventBus: bus,
      eventPattern: { detailType: ['audit.recorded'] },
      targets: [new LambdaFunction(auditLog)],
    });

    // HTTP API
    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: 'monsternote-dev',
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: props.webOrigins,
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
        ],
        allowHeaders: ['authorization', 'content-type'],
        exposeHeaders: ['x-request-id'],
        maxAge: Duration.hours(1),
      },
    });
    const stage = new HttpStage(this, 'DefaultStage', {
      httpApi: this.httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
    });
    const accessLogs = new LogGroup(this, 'ApiAccessLogs', {
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // アクセスログ（IP と利用者の情報は出さない）
    (stage.node.defaultChild as CfnStage).accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        routeKey: '$context.routeKey',
        status: '$context.status',
        latency: '$context.responseLatency',
        integrationError: '$context.integrationErrorMessage',
      }),
    };

    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', props.auth.userPool, {
      userPoolClients: [props.auth.userPoolClient],
    });
    const route = (method: HttpMethod, path: string, target: NodejsFunction, open = false) =>
      this.httpApi.addRoutes({
        path,
        methods: [method],
        integration: new HttpLambdaIntegration(
          `${method}${path.replace(/[^A-Za-z]/g, '')}`,
          target,
        ),
        ...(open ? {} : { authorizer }),
      });
    // 証明を確かめない道は、ログインと証明の出し直しだけ（NFR4.2）
    route(HttpMethod.POST, '/v1/session', accounts, true);
    route(HttpMethod.POST, '/v1/session/refresh', accounts, true);
    route(HttpMethod.DELETE, '/v1/session', accounts);
    route(HttpMethod.POST, '/v1/photos', reporting);
    route(HttpMethod.POST, '/v1/photos/{photoId}/complete', reporting);
    route(HttpMethod.POST, '/v1/reports', reporting);
    route(HttpMethod.GET, '/v1/reports/{reportId}', reporting);
    route(HttpMethod.GET, '/v1/reviews/{reportId}', review);
    route(HttpMethod.PUT, '/v1/reviews/{reportId}/decision', review);
    route(HttpMethod.POST, '/v1/reviews/{reportId}/decision/undo', review);
    route(HttpMethod.GET, '/v1/catalog/reports', catalog);
    route(HttpMethod.GET, '/v1/catalog/my-reports', catalog);
    // U2: 対象地域の読み出し（ADR-010。担当は Reporting が内部で Settings を呼ぶ）
    route(HttpMethod.GET, '/v1/report-settings', reporting);
    // U2: 重複の疑いの相手の一覧（C5。担当は DuplicateDetection。BR8.9）
    route(HttpMethod.GET, '/v1/duplicates/{reportId}', duplicateDetection);

    // U4: 初回の手続き（BR11.4〜BR11.7）
    route(HttpMethod.PUT, '/v1/me/password', accounts);
    route(HttpMethod.PUT, '/v1/me/consent', accounts);
    route(HttpMethod.PUT, '/v1/me/hunter-number', accounts);
    route(HttpMethod.GET, '/v1/me', accounts);
    // U4: 管理者のアカウント管理（BR11.1〜BR11.3・BR11.9）
    route(HttpMethod.GET, '/v1/admin/accounts', accounts);
    route(HttpMethod.POST, '/v1/admin/accounts', accounts);
    route(HttpMethod.PUT, '/v1/admin/accounts/{accountId}/status', accounts);
    route(HttpMethod.POST, '/v1/admin/accounts/{accountId}/password-reset', accounts);
    // U4: 設定の読み書き（UC25。BR9.2・BR9.4）
    route(HttpMethod.GET, '/v1/admin/settings', settings);
    route(HttpMethod.PUT, '/v1/admin/settings', settings);
    // U4: 操作の記録の一覧（UC27。BR12.1）
    route(HttpMethod.GET, '/v1/admin/audit-entries', auditLog);
    // U4: 試験運用の終わりの削除（BR13.1。順番①〜⑤）
    route(HttpMethod.POST, '/v1/admin/catalog-data', catalog);
    route(HttpMethod.POST, '/v1/admin/review-data', review);
    route(HttpMethod.POST, '/v1/admin/duplicate-data', duplicateDetection);
    route(HttpMethod.POST, '/v1/admin/detection-data', reporting);
    route(HttpMethod.POST, '/v1/admin/reporting-data', reporting);

    // 監視（monitoring-design）: アラーム 2 つと SNS のメール
    const topic = new Topic(this, 'AlarmTopic', { topicName: 'masahiro-sns-monsternote-alarm' });
    if (props.alarmEmail) topic.addSubscription(new EmailSubscription(props.alarmEmail));
    const period = Duration.minutes(5);
    const apiMetric = (metricName: string) =>
      new Metric({
        namespace: 'AWS/ApiGateway',
        metricName,
        dimensionsMap: { ApiId: this.httpApi.apiId },
        statistic: 'Sum',
        period,
      });
    const api5xx = new Alarm(this, 'Api5xxAlarm', {
      alarmName: 'masahiro-cloudwatch-monsternote-api-5xx',
      alarmDescription: 'API の 5xx の割合が 5 分間で 5% を超えた（呼び出し 5 回以上のとき）',
      metric: new MathExpression({
        expression: 'IF(cnt >= 5, e5xx / cnt * 100, 0)',
        usingMetrics: { e5xx: apiMetric('5xx'), cnt: apiMetric('Count') },
        period,
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    // CloudWatch のアラームは、1 つのアラームで使える指標の合計が最大 10 個（数式を入れ子にしても
    // 最終的には 1 つのアラームの指標一覧として平らに展開されるため、入れ子にしても回避できない。
    // 関数が 12 個になった実機デプロイで実際に "Too many metrics in alarm, maximum is 10" で失敗して判明した）。
    // そのため、関数を 9 個以下ずつの組に分け、組ごとに別のアラームを作る（同じ SNS トピックへ通知する）。
    const LAMBDA_ERRORS_ALARM_GROUP_SIZE = 9;
    const fnList = Object.values(this.functions);
    const lambdaErrorsAlarms = fnList
      .reduce<IMetric[][]>((groups, fn, i) => {
        const metric = fn.metricErrors({ period, statistic: 'Sum' });
        const groupIndex = Math.floor(i / LAMBDA_ERRORS_ALARM_GROUP_SIZE);
        (groups[groupIndex] ??= []).push(metric);
        return groups;
      }, [])
      .map((group, i) => {
        const using = Object.fromEntries(group.map((m, j) => [`m${j}`, m]));
        return new Alarm(this, `LambdaErrorsAlarm${i}`, {
          alarmName: `masahiro-cloudwatch-monsternote-lambda-errors-${i}`,
          alarmDescription: `5 分間で関数グループ ${i} のエラーの合計が 3 回以上`,
          metric: new MathExpression({
            expression: Object.keys(using).join('+'),
            usingMetrics: using,
            period,
          }),
          threshold: 3,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        });
      });
    for (const alarm of [api5xx, ...lambdaErrorsAlarms]) alarm.addAlarmAction(new SnsAction(topic));
  }

  /** API の URL（末尾の / なし） */
  get apiUrl(): string {
    return this.httpApi.apiEndpoint;
  }
}
