// SpeciesDetection の表（DetectionResults。キー photoId）の読み書き。entities.md の DetectionResult。
// 写真 1 枚に結果は 1 つ（Q6・Q8）。TTL は expiresAt（Photo と同じ値を写す。BR2.13）。
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export type Species = 'bear' | 'boar' | 'deer';
export type DetectionOutcome = 'detected' | 'undetected';
export type DetectionFailureReason = 'low-confidence' | 'no-animal' | 'service-error' | 'timeout';

export interface RawLabel {
  name: string;
  confidence: number;
}

export interface DetectionResultRecord {
  detectionId: string;
  photoId: string;
  outcome: DetectionOutcome;
  species?: Species;
  confidence?: number;
  rawLabels?: RawLabel[];
  failureReason?: DetectionFailureReason;
  detectedAt: string;
  /** uploadedAt + 24 時間（Photo と同じ値。報告に結び付くとき消す。BR2.13） */
  expiresAt: number;
}

export type SpeciesDetectionRepository = ReturnType<typeof createSpeciesDetectionRepository>;

export function createSpeciesDetectionRepository(ddb: DynamoDBDocumentClient, tableName: string) {
  return {
    /** 写真を選び直すと新しい結果で上書きする（Q6・Q8。前の結果は残さない） */
    async put(result: DetectionResultRecord): Promise<void> {
      await ddb.send(new PutCommand({ TableName: tableName, Item: result }));
    },

    async getByPhotoId(photoId: string): Promise<DetectionResultRecord | undefined> {
      const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { photoId } }));
      return res.Item as DetectionResultRecord | undefined;
    },
  };
}
