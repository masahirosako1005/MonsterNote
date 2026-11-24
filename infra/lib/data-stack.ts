// MonsterNote-Data-dev: DynamoDB の表 12 個（U1 の 7 つ + U2 の 5 つ）と写真の S3。表は RETAIN（NFR11.2）。
// 物理的な名前は CDK に作らせる。写真の S3 は、作成から 1 日のライフサイクルルールを持つ（scalability-design §3）。
import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, type TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface DataStackProps extends StackProps {
  /** 写真の S3 の CORS に許す 2 つの画面の Origin */
  webOrigins: string[];
}

export interface DataTables {
  accounts: Table;
  photos: Table;
  reports: Table;
  submissionKeys: Table;
  reviewDecisions: Table;
  reportListItems: Table;
  processedEvents: Table;
  detectionResults: Table;
  reportFootprints: Table;
  duplicateSuspicions: Table;
  settings: Table;
  detectionRateLimits: Table;
}

export class DataStack extends Stack {
  readonly tables: DataTables;
  readonly photoBucket: Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const table = (name: string, partitionKey: string, extra: Partial<TableProps> = {}) =>
      new Table(this, `${name}Table`, {
        partitionKey: { name: partitionKey, type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.RETAIN,
        ...extra,
      });

    const accounts = table('Accounts', 'accountId');
    accounts.addGlobalSecondaryIndex({
      indexName: 'loginId',
      partitionKey: { name: 'loginId', type: AttributeType.STRING },
    });

    const reportListItems = table('ReportListItems', 'reportId');
    // 一覧の索引（BR4.4）: 依頼元用は固定のパーティション、ハンター用はハンターの ID。どちらも sortKey=submittedAt#reportId
    reportListItems.addGlobalSecondaryIndex({
      indexName: 'gsiAll',
      partitionKey: { name: 'listPartition', type: AttributeType.STRING },
      sortKey: { name: 'sortKey', type: AttributeType.STRING },
    });
    reportListItems.addGlobalSecondaryIndex({
      indexName: 'gsiHunter',
      partitionKey: { name: 'hunterAccountId', type: AttributeType.STRING },
      sortKey: { name: 'sortKey', type: AttributeType.STRING },
    });

    // U2: 全身の写真の判別の結果（キー photoId。結び付かなかった結果は TTL で消える。BR2.13）
    const detectionResults = table('DetectionResults', 'photoId', {
      timeToLiveAttribute: 'expiresAt',
    });

    // U2: 重複の判定に使う索引（キー reportId）。speciesDay の GSI で前後 3 日分を読む（BR8.3）
    const reportFootprints = table('ReportFootprints', 'reportId');
    reportFootprints.addGlobalSecondaryIndex({
      indexName: 'speciesDay',
      partitionKey: { name: 'speciesDay', type: AttributeType.STRING },
    });

    // U2: 重複の疑い（キー suspicionId）。reportId の GSI で報告ごとの一覧を読む（BR8.9）
    const duplicateSuspicions = table('DuplicateSuspicions', 'suspicionId');
    duplicateSuspicions.addGlobalSecondaryIndex({
      indexName: 'byReportId',
      partitionKey: { name: 'reportId', type: AttributeType.STRING },
    });

    this.tables = {
      accounts,
      photos: table('Photos', 'photoId'),
      reports: table('Reports', 'reportId'),
      submissionKeys: table('SubmissionKeys', 'submissionKey'),
      reviewDecisions: table('ReviewDecisions', 'reportId'),
      reportListItems,
      // 知らせの受け手の処理済みの eventId（NFR10.4）。7 日で TTL により消える
      processedEvents: table('ProcessedEvents', 'consumerEventId', {
        timeToLiveAttribute: 'expiresAt',
      }),
      detectionResults,
      reportFootprints,
      duplicateSuspicions,
      // U2: 重複の基準と対象地域（キー settingKey。1 行だけ。BR9.3）
      settings: table('Settings', 'settingKey'),
      // U2: 判別の呼び出し回数の上限（キー accountIdDate）。作成から 2 日で TTL により消える（NFR12.5）
      detectionRateLimits: table('DetectionRateLimits', 'accountIdDate', {
        timeToLiveAttribute: 'ttl',
      }),
    };

    this.photoBucket = new Bucket(this, 'PhotoBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      // 署名付きの POST でアップロードし、表示は署名付きの GET（Q1）
      cors: [
        {
          allowedMethods: [HttpMethods.POST, HttpMethods.GET],
          allowedOrigins: props.webOrigins,
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      // U2（scalability-design §3）: 報告に結び付かなかった写真を、作成から 1 日で自動的に消す
      lifecycleRules: [{ expiration: Duration.days(1) }],
    });
  }
}
