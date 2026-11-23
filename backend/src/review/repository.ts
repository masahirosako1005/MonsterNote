// Review の表（ReviewDecisions。キー reportId）の読み書き。entities.md の ReviewDecision と reliability-design の eventSent。
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';

export type ReviewStatus = 'checking' | 'approved' | 'rejected';

export interface ReviewDecisionRecord {
  reportId: string;
  hunterAccountId: string;
  status: ReviewStatus;
  decidedByAccountId?: string;
  decidedByName?: string;
  decidedAt?: string;
  submittedAt: string;
  lastEventAt: string;
  /** review.status-changed を送ったか（確認中の記録では送るものがないため true） */
  eventSent: boolean;
}

export type ReviewRepository = ReturnType<typeof createReviewRepository>;

export function createReviewRepository(ddb: DynamoDBDocumentClient, tableName: string) {
  return {
    async get(reportId: string): Promise<ReviewDecisionRecord | undefined> {
      const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { reportId } }));
      return res.Item as ReviewDecisionRecord | undefined;
    },

    /** 確認中の記録を作る。すでにあれば false（書き換えない） */
    async createChecking(record: ReviewDecisionRecord): Promise<boolean> {
      try {
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: record,
            ConditionExpression: 'attribute_not_exists(reportId)',
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    /** 確認中のときだけ承認にする（BR3.3。先に受け付けた操作だけが有効）。確認中でなければ false */
    async approve(
      reportId: string,
      decidedByAccountId: string,
      decidedByName: string,
      decidedAt: string,
    ): Promise<boolean> {
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { reportId },
            UpdateExpression:
              'SET #status = :approved, decidedByAccountId = :by, decidedByName = :name, decidedAt = :at, lastEventAt = :at, eventSent = :false',
            ConditionExpression: '#status = :checking',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':approved': 'approved',
              ':checking': 'checking',
              ':by': decidedByAccountId,
              ':name': decidedByName,
              ':at': decidedAt,
              ':false': false,
            },
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    async markEventSent(reportId: string): Promise<void> {
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { reportId },
          UpdateExpression: 'SET eventSent = :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      );
    },
  };
}
