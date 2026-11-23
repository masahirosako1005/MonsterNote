// MonsterNote-Api-dev: HTTP API（JWT オーソライザー・流量・CORS）、関数 7 つ、EventBridge、アラーム 2 つと SNS。
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
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
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
        USER_POOL_CLIENT_ID: props.auth.userPoolClient.userPoolClientId,
      },
    });
    const reporting = fn('Reporting', 'reporting', {
      memory: 256,
      timeoutSec: 8,
      env: {
        PHOTOS_TABLE: tables.photos.tableName,
        REPORTS_TABLE: tables.reports.tableName,
        SUBMISSION_KEYS_TABLE: tables.submissionKeys.tableName,
        PHOTO_BUCKET: photoBucket.bucketName,
        EVENT_BUS_NAME: bus.eventBusName,
        ACCOUNTS_FUNCTION_NAME: accounts.functionName,
      },
    });
    const review = fn('Review', 'review', {
      timeoutSec: 8,
      env: {
        REVIEW_DECISIONS_TABLE: tables.reviewDecisions.tableName,
        EVENT_BUS_NAME: bus.eventBusName,
      },
    });
    const catalog = fn('Catalog', 'catalog', {
      timeoutSec: 8,
      env: { REPORT_LIST_ITEMS_TABLE: tables.reportListItems.tableName },
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
    this.functions = {
      accounts,
      reporting,
      review,
      catalog,
      reviewOnSaved,
      catalogOnSaved,
      catalogOnStatus,
    };

    // 関数ごとの IAM: 自分の表だけ（logical-components の分け方）
    tables.accounts.grantReadData(accounts);
    for (const t of [tables.photos, tables.reports, tables.submissionKeys])
      t.grantReadWriteData(reporting);
    photoBucket.grantPut(reporting);
    photoBucket.grantRead(reporting);
    photoBucket.grantDelete(reporting);
    bus.grantPutEventsTo(reporting);
    // 部品の間の直接の呼び出し C10: Reporting だけが Accounts の関数を呼べる（NFR4.4）
    accounts.grantInvoke(reporting);
    tables.reviewDecisions.grantReadWriteData(review);
    bus.grantPutEventsTo(review);
    tables.reportListItems.grantReadData(catalog);
    tables.reviewDecisions.grantReadWriteData(reviewOnSaved);
    for (const consumer of [catalogOnSaved, catalogOnStatus])
      tables.reportListItems.grantReadWriteData(consumer);
    for (const consumer of [reviewOnSaved, catalogOnSaved, catalogOnStatus]) {
      tables.processedEvents.grantReadWriteData(consumer);
    }

    // 知らせ: 送り手（source）で絞り、受け手の関数に配る。受け手は EventBridge からだけ呼べる
    new Rule(this, 'ReportSavedRule', {
      eventBus: bus,
      eventPattern: { source: ['monsternote.reporting'], detailType: ['report.saved'] },
      targets: [new LambdaFunction(reviewOnSaved), new LambdaFunction(catalogOnSaved)],
    });
    new Rule(this, 'StatusChangedRule', {
      eventBus: bus,
      eventPattern: { source: ['monsternote.review'], detailType: ['review.status-changed'] },
      targets: [new LambdaFunction(catalogOnStatus)],
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
    route(HttpMethod.GET, '/v1/catalog/reports', catalog);
    route(HttpMethod.GET, '/v1/catalog/my-reports', catalog);

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
    const fnList = Object.values(this.functions);
    const errorMetrics = Object.fromEntries(
      fnList.map((f, i) => [`e${i}`, f.metricErrors({ period, statistic: 'Sum' })]),
    );
    const lambdaErrors = new Alarm(this, 'LambdaErrorsAlarm', {
      alarmName: 'masahiro-cloudwatch-monsternote-lambda-errors',
      alarmDescription: '5 分間で全関数のエラーの合計が 3 回以上',
      metric: new MathExpression({
        expression: Object.keys(errorMetrics).join(' + '),
        usingMetrics: errorMetrics,
        period,
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    for (const alarm of [api5xx, lambdaErrors]) alarm.addAlarmAction(new SnsAction(topic));
  }

  /** API の URL（末尾の / なし） */
  get apiUrl(): string {
    return this.httpApi.apiEndpoint;
  }
}
