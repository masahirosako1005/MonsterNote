// U2 で足す 5 つの表の DynamoDB Local 用の定義（結合の試験で使う。skeleton-flow.u1.test.ts の tables と同じ形）
import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

export const u2Tables: CreateTableCommandInput[] = [
  {
    TableName: 'DetectionResults',
    KeySchema: [{ AttributeName: 'photoId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'photoId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ReportFootprints',
    KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'reportId', AttributeType: 'S' },
      { AttributeName: 'speciesDay', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'speciesDay',
        KeySchema: [{ AttributeName: 'speciesDay', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'DuplicateSuspicions',
    KeySchema: [{ AttributeName: 'suspicionId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'suspicionId', AttributeType: 'S' },
      { AttributeName: 'reportId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byReportId',
        KeySchema: [{ AttributeName: 'reportId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'Settings',
    KeySchema: [{ AttributeName: 'settingKey', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'settingKey', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'DetectionRateLimits',
    KeySchema: [{ AttributeName: 'accountIdDate', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'accountIdDate', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
];
