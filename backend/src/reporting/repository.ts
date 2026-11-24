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
/** U2（D-4）: 端末で JPEG に縮小してから送るため、サーバーが受け付けるのは JPEG だけ */
export type PhotoContentType = 'image/jpeg';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PhotoRecord {
  photoId: string;
  uploadedByAccountId: string;
  reportId?: string;
  kind: PhotoKind;
  storageKey: string;
  contentType: PhotoContentType;
  sizeBytes: number;
  uploadStatus: 'pending' | 'uploaded';
  /** 画面が縮小の前に読み取った撮影日時・位置（BR2.10）。無ければ空 */
  exifCapturedAt?: string;
  exifLocation?: GeoPoint;
  uploadedAt: string;
  /** uploadedAt + 24 時間（Unix 秒。TTL）。報告に結び付くとき外す（BR2.13） */
  expiresAt?: number;
}

export type Species = 'bear' | 'boar' | 'deer';
export type Sex = 'male' | 'female' | 'unknown';
export type AgeClass = 'adult' | 'juvenile';
export type CaptureMethod = 'trap' | 'gun' | 'other';
/** U2（entities.md）: capturedAt・location の出どころ。U1 の device はやめる */
export type FieldSource = 'exif' | 'manual';
export type DetectionOutcome = 'detected' | 'undetected';

export interface ReportRecord {
  reportId: string;
  submissionKey: string;
  hunterAccountId: string;
  hunterNumber: string;
  capturedAt: string;
  capturedAtSource: FieldSource;
  location: GeoPoint;
  locationSource: FieldSource;
  placeName?: string;
  /** capturedAtSource か locationSource のどちらかが manual なら true（BR2.12） */
  manualEntry: boolean;
  species: Species;
  autoDetectedSpecies?: Species;
  autoDetectionOutcome: DetectionOutcome;
  autoDetectionConfidence?: number;
  sex: Sex;
  ageClass: AgeClass;
  captureMethod: CaptureMethod;
  /** species=bear のときだけ使う。胸の写真を撮らなかった印（BR2.17） */
  chestPhotoMissing?: boolean;
  /** 送信前の重複の知らせで「別の個体なので送る」を選んだか（BR7.2） */
  confirmedNotDuplicate: boolean;
  submittedAt: string;
  /** 全身の写真（kind=body）の ID。report.saved の bodyPhotoId（C12）と詳細の写真の表示に使う */
  bodyPhotoId: string;
  /** 尻尾の写真（kind=tail）の ID。U2 で必須（BR2.17） */
  tailPhotoId: string;
  /** 胸の写真（kind=chest）の ID。クマで撮れたときだけ（BR2.17） */
  chestPhotoId?: string;
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

    /**
     * 報告の保存・送信のキーの「保存済み」・写真（全身・尻尾・胸）の reportId を 1 つのトランザクションで書く。
     * 写真の記録がまだあること（attribute_exists(photoId)）を条件にする（reliability-design NFR10.14。
     * BR2.13 の自動削除〈TTL〉が先に消していれば、このトランザクションは失敗し、報告は保存されない）。
     * reportId を入れるのとあわせて expiresAt を外す（BR2.13）。
     */
    async saveReport(report: ReportRecord): Promise<void> {
      const photoIds = [report.bodyPhotoId, report.tailPhotoId, report.chestPhotoId].filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );
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
            ...photoIds.map((photoId) => ({
              Update: {
                TableName: tables.photos,
                Key: { photoId },
                UpdateExpression: 'SET reportId = :reportId REMOVE expiresAt',
                ConditionExpression:
                  'uploadedByAccountId = :hunter AND uploadStatus = :uploaded AND attribute_exists(photoId) AND attribute_not_exists(reportId)',
                ExpressionAttributeValues: {
                  ':reportId': report.reportId,
                  ':hunter': report.hunterAccountId,
                  ':uploaded': 'uploaded',
                },
              },
            })),
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
