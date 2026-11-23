// Reporting の表（Photos・Reports・SubmissionKeys）の読み書き。entities.md の Photo・Report と reliability-design の送信のキー。
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { isConditionFailure } from '../shared/dynamo';

export interface ReportingTables {
  photos: string;
  reports: string;
  submissionKeys: string;
}

export type PhotoKind = 'body' | 'tail' | 'chest';
export type PhotoContentType = 'image/jpeg' | 'image/png' | 'image/heic';

export interface PhotoRecord {
  photoId: string;
  uploadedByAccountId: string;
  reportId?: string;
  kind: PhotoKind;
  storageKey: string;
  contentType: PhotoContentType;
  sizeBytes: number;
  uploadStatus: 'pending' | 'uploaded';
  uploadedAt: string;
}

export type Species = 'bear' | 'boar' | 'deer';
export type Sex = 'male' | 'female' | 'unknown';

export interface ReportRecord {
  reportId: string;
  submissionKey: string;
  hunterAccountId: string;
  hunterNumber: string;
  capturedAt: string;
  capturedAtSource: 'device' | 'exif' | 'manual';
  location: { lat: number; lng: number };
  locationSource: 'device' | 'exif' | 'manual';
  species: Species;
  sex: Sex;
  submittedAt: string;
  /** 全身の写真（kind=body）の ID。report.saved の bodyPhotoId（C12）と詳細の写真の表示に使う */
  bodyPhotoId: string;
  /** report.saved を送ったか（reliability-design NFR10.3） */
  eventSent: boolean;
}

export interface SubmissionKeyRecord {
  submissionKey: string;
  hunterAccountId: string;
  state: 'creating' | 'saved';
  leaseExpiresAt?: string;
  reportId?: string;
}

export { isConditionFailure };

export type ReportingRepository = ReturnType<typeof createReportingRepository>;

export function createReportingRepository(ddb: DynamoDBDocumentClient, tables: ReportingTables) {
  return {
    async putPhoto(photo: PhotoRecord): Promise<void> {
      await ddb.send(
        new PutCommand({
          TableName: tables.photos,
          Item: photo,
          ConditionExpression: 'attribute_not_exists(photoId)',
        }),
      );
    },

    async getPhoto(photoId: string): Promise<PhotoRecord | undefined> {
      const res = await ddb.send(new GetCommand({ TableName: tables.photos, Key: { photoId } }));
      return res.Item as PhotoRecord | undefined;
    },

    async markPhotoUploaded(photoId: string, uploadedAt: string): Promise<void> {
      await ddb.send(
        new UpdateCommand({
          TableName: tables.photos,
          Key: { photoId },
          UpdateExpression: 'SET uploadStatus = :uploaded, uploadedAt = :at',
          ConditionExpression: 'attribute_exists(photoId)',
          ExpressionAttributeValues: { ':uploaded': 'uploaded', ':at': uploadedAt },
        }),
      );
    },

    async getSubmissionKey(submissionKey: string): Promise<SubmissionKeyRecord | undefined> {
      const res = await ddb.send(
        new GetCommand({ TableName: tables.submissionKeys, Key: { submissionKey } }),
      );
      return res.Item as SubmissionKeyRecord | undefined;
    },

    /**
     * 「作成中」を条件付きで書く。previousLease を渡したときは、期限切れの「作成中」を取り直す。
     * ほかの呼び出しが先に書いていたら false を返す。
     */
    async acquireSubmissionKey(
      submissionKey: string,
      hunterAccountId: string,
      leaseExpiresAt: string,
      previousLease?: string,
    ): Promise<boolean> {
      try {
        if (previousLease === undefined) {
          await ddb.send(
            new PutCommand({
              TableName: tables.submissionKeys,
              Item: { submissionKey, hunterAccountId, state: 'creating', leaseExpiresAt },
              ConditionExpression: 'attribute_not_exists(submissionKey)',
            }),
          );
        } else {
          await ddb.send(
            new UpdateCommand({
              TableName: tables.submissionKeys,
              Key: { submissionKey },
              UpdateExpression: 'SET leaseExpiresAt = :lease',
              ConditionExpression: '#state = :creating AND leaseExpiresAt = :previous',
              ExpressionAttributeNames: { '#state': 'state' },
              ExpressionAttributeValues: {
                ':lease': leaseExpiresAt,
                ':creating': 'creating',
                ':previous': previousLease,
              },
            }),
          );
        }
        return true;
      } catch (err) {
        if (isConditionFailure(err)) return false;
        throw err;
      }
    },

    /** 保存の前に失敗したとき「作成中」を消し、すぐに送り直せるようにする */
    async releaseSubmissionKey(submissionKey: string): Promise<void> {
      try {
        await ddb.send(
          new DeleteCommand({
            TableName: tables.submissionKeys,
            Key: { submissionKey },
            ConditionExpression: '#state = :creating',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':creating': 'creating' },
          }),
        );
      } catch (err) {
        if (!isConditionFailure(err)) throw err;
      }
    },

    /** 報告の保存・送信のキーの「保存済み」・写真の reportId を 1 つのトランザクションで書く */
    async saveReport(report: ReportRecord): Promise<void> {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tables.reports,
                Item: report,
                ConditionExpression: 'attribute_not_exists(reportId)',
              },
            },
            {
              Update: {
                TableName: tables.submissionKeys,
                Key: { submissionKey: report.submissionKey },
                UpdateExpression: 'SET #state = :saved, reportId = :reportId REMOVE leaseExpiresAt',
                ConditionExpression: '#state = :creating AND hunterAccountId = :hunter',
                ExpressionAttributeNames: { '#state': 'state' },
                ExpressionAttributeValues: {
                  ':saved': 'saved',
                  ':creating': 'creating',
                  ':reportId': report.reportId,
                  ':hunter': report.hunterAccountId,
                },
              },
            },
            {
              Update: {
                TableName: tables.photos,
                Key: { photoId: report.bodyPhotoId },
                UpdateExpression: 'SET reportId = :reportId',
                ConditionExpression:
                  'uploadedByAccountId = :hunter AND uploadStatus = :uploaded AND attribute_not_exists(reportId)',
                ExpressionAttributeValues: {
                  ':reportId': report.reportId,
                  ':hunter': report.hunterAccountId,
                  ':uploaded': 'uploaded',
                },
              },
            },
          ],
        }),
      );
    },

    async getReport(reportId: string): Promise<ReportRecord | undefined> {
      const res = await ddb.send(new GetCommand({ TableName: tables.reports, Key: { reportId } }));
      return res.Item as ReportRecord | undefined;
    },

    async markReportEventSent(reportId: string): Promise<void> {
      await ddb.send(
        new UpdateCommand({
          TableName: tables.reports,
          Key: { reportId },
          UpdateExpression: 'SET eventSent = :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      );
    },
  };
}
