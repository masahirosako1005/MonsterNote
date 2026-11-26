// Review の表（ReviewDecisions。キー reportId）の読み書き。entities.md の ReviewDecision と reliability-design の eventSent。
// U3: 却下（reason・reasonText）・取り消し（undoUntil）を本番にする（reliability-design.md §1 の ConditionExpression のとおり）。
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';
import type { RejectReason } from './validate-reject';

export type ReviewStatus = 'checking' | 'approved' | 'rejected';

export interface ReviewDecisionRecord {
  reportId: string;
  hunterAccountId: string;
  status: ReviewStatus;
  reason?: RejectReason;
  reasonText?: string;
  decidedByAccountId?: string;
  decidedByName?: string;
  decidedAt?: string;
  /** 取り消せる期限（decidedAt + 10 秒）。status=checking のときは無い */
  undoUntil?: string;
  submittedAt: string;
  lastEventAt: string;
  /** review.status-changed を送ったか（確認中の記録では送るものがないため true） */
  eventSent: boolean;
}

export interface DecideInput {
  status: 'approved' | 'rejected';
  decidedByAccountId: string;
  decidedByName: string;
  decidedAt: string;
  undoUntil: string;
  reason?: RejectReason;
  reasonText?: string;
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

    /**
     * 確認中のときだけ承認・却下にする（BR3.3。先に受け付けた操作だけが有効）。
     * reliability-design.md §1 のとおり単一の ConditionExpression（status = :checking）。
     * 確認中でなければ false
     */
    async decide(reportId: string, input: DecideInput): Promise<boolean> {
      const isRejected = input.status === 'rejected';
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { reportId },
            UpdateExpression:
              'SET #status = :status, decidedByAccountId = :by, decidedByName = :name, ' +
              'decidedAt = :at, undoUntil = :undo, lastEventAt = :at, eventSent = :false' +
              (isRejected ? ', #reason = :reason' : '') +
              (isRejected && input.reasonText !== undefined ? ', reasonText = :reasonText' : ''),
            ConditionExpression: '#status = :checking',
            ExpressionAttributeNames: {
              '#status': 'status',
              ...(isRejected ? { '#reason': 'reason' } : {}),
            },
            ExpressionAttributeValues: {
              ':status': input.status,
              ':checking': 'checking',
              ':by': input.decidedByAccountId,
              ':name': input.decidedByName,
              ':at': input.decidedAt,
              ':undo': input.undoUntil,
              ':false': false,
              ...(isRejected ? { ':reason': input.reason } : {}),
              ...(isRejected && input.reasonText !== undefined
                ? { ':reasonText': input.reasonText }
                : {}),
            },
          }),
        );
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    /**
     * 取り消し（BR3.9）。「確認中でない」「本人」「期限内」を条件にした 1 回の書き換えで確認中に戻す。
     * reliability-design.md §1 のとおり、記録を読んで判断するのではなく条件付きの書き換えで行う。
     * 成功したときは、書き換え前の記録（ReturnValues: ALL_OLD）を返す（previousStatus の計算に使う）。
     * 条件に合わなければ false（呼んだ側が記録を読み直して理由を判定する。BR3.9 の順）
     */
    async undo(
      reportId: string,
      callerAccountId: string,
      nowIso: string,
    ): Promise<ReviewDecisionRecord | false> {
      try {
        const res = await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { reportId },
            UpdateExpression:
              'SET #status = :checking, lastEventAt = :now, eventSent = :false ' +
              'REMOVE #reason, reasonText, decidedByAccountId, decidedByName, decidedAt, undoUntil',
            ConditionExpression:
              '#status <> :checking AND decidedByAccountId = :acct AND undoUntil >= :now',
            ExpressionAttributeNames: { '#status': 'status', '#reason': 'reason' },
            ExpressionAttributeValues: {
              ':checking': 'checking',
              ':acct': callerAccountId,
              ':now': nowIso,
              ':false': false,
            },
            ReturnValues: 'ALL_OLD',
          }),
        );
        return res.Attributes as ReviewDecisionRecord;
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
