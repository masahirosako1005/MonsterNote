// MonsterNote-Data-dev: DynamoDB の表 7 つと写真の S3。すべて RETAIN（NFR11.2）。物理的な名前は CDK に作らせる。
import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
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
    });
  }
}
