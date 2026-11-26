// 写真の受け付け（C2 POST /v1/photos）とアップロードの完了（POST /v1/photos/{photoId}/complete）。
// BR2.2（D-4）: 端末で縮小した JPEG だけを 15 MB まで受け付け、アップロード用の URL は 5 分。
// BR2.9: 完了の知らせで、S3 に実物があり大きさと形式が申告どおりかを確かめる。違えば消して拒否する。
// BR6.2・BR6.3: 全身の写真（kind=body）はアップロードの完了のたびに種類を判別する（3 秒で区切る）。
// NFR12.5: 判別の呼び出しは 1 日 30 回まで（DetectionRateLimit）。
// NFR5.3: 署名付きの POST の条件（キー・内容の種類・content-length-range）を S3 が強制する。
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { DetectLabelsCommand, type RekognitionClient } from '@aws-sdk/client-rekognition';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getCaller, requireOwner, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { withTimeout } from '../shared/events';
import { json, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import {
  classifyLabels,
  classifyServiceFailure,
  type ClassifyResult,
} from '../species-detection/classify';
import type { DetectionRateLimiter } from '../species-detection/rate-limit';
import type { RawLabel, SpeciesDetectionRepository } from '../species-detection/repository';
import type { GeoPoint, PhotoContentType, PhotoKind, ReportingRepository } from './repository';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const UPLOAD_URL_SECONDS = 5 * 60;
/** BR2.13: 受け付けから 24 時間で自動的に消す */
export const PHOTO_TTL_SECONDS = 24 * 60 * 60;
/** BR6.2・performance-design §1: 判別は 3 秒で区切る */
export const DETECTION_TIMEOUT_MS = 3_000;
/** U2（D-4）: 端末で JPEG に縮小してから送るため、サーバーは JPEG だけを受け付ける */
const CONTENT_TYPES: readonly PhotoContentType[] = ['image/jpeg'];
const KINDS: readonly PhotoKind[] = ['body', 'tail', 'chest'];

export interface PhotoDeps {
  repo: ReportingRepository;
  detectionRepo: SpeciesDetectionRepository;
  rekognition: RekognitionClient;
  rateLimiter: DetectionRateLimiter;
  s3: S3Client;
  bucket: string;
  now?: () => Date;
  newId?: () => string;
}

export function photoStorageKey(accountId: string, photoId: string): string {
  return `photos/${accountId}/${photoId}`;
}

function photoIdOf(params: Record<string, string | undefined> | undefined): string {
  const photoId = params?.photoId;
  if (!photoId) throw errors.validation([{ field: 'photoId', reason: 'required' }]);
  return photoId;
}

function geoPointOf(value: unknown): GeoPoint | undefined {
  const point = value as { lat?: unknown; lng?: unknown } | undefined;
  if (
    typeof point?.lat === 'number' &&
    Number.isFinite(point.lat) &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lng)
  ) {
    return { lat: point.lat, lng: point.lng };
  }
  return undefined;
}

interface DetectionOutcomeView {
  outcome: ClassifyResult['outcome'];
  species?: ClassifyResult['species'];
  confidence?: ClassifyResult['confidence'];
}

/** BR6.2・BR6.3: Rekognition を 3 秒で区切って呼ぶ。失敗・時間切れも「判別できなかった」として返す */
async function detectSpecies(
  rekognition: RekognitionClient,
  bucket: string,
  storageKey: string,
): Promise<{ result: ClassifyResult; rawLabels?: RawLabel[] }> {
  try {
    const res = await withTimeout(
      rekognition.send(
        new DetectLabelsCommand({
          Image: { S3Object: { Bucket: bucket, Name: storageKey } },
          MaxLabels: 20,
          MinConfidence: 50,
        }),
      ),
      DETECTION_TIMEOUT_MS,
    );
    const rawLabels: RawLabel[] = (res.Labels ?? []).map((l) => ({
      name: l.Name ?? '',
      confidence: l.Confidence ?? 0,
    }));
    return { result: classifyLabels(rawLabels), rawLabels };
  } catch (err) {
    const timedOut = err instanceof Error && err.message.startsWith('timeout after');
    return { result: classifyServiceFailure(timedOut ? 'timeout' : 'service-error') };
  }
}

export function createPhotoRoutes(deps: PhotoDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  return {
    'POST /v1/photos': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter');
      const body = parseJsonBody(event);
      const details = [];
      if (!KINDS.includes(body.kind as PhotoKind))
        details.push({ field: 'kind', reason: 'unsupported' });
      if (!CONTENT_TYPES.includes(body.contentType as PhotoContentType)) {
        details.push({ field: 'contentType', reason: 'unsupported' });
      }
      const size = body.sizeBytes;
      if (
        typeof size !== 'number' ||
        !Number.isInteger(size) ||
        size < 1 ||
        size > MAX_PHOTO_BYTES
      ) {
        details.push({ field: 'sizeBytes', reason: 'out-of-range' });
      }
      if (details.length > 0) {
        throw errors.unprocessable('VALIDATION_FAILED', '写真は JPEG で 15 MB までです', details);
      }

      const photoId = newId();
      const contentType = body.contentType as PhotoContentType;
      const storageKey = photoStorageKey(caller.accountId, photoId);
      const acceptedAt = now();
      const post = await createPresignedPost(deps.s3, {
        Bucket: deps.bucket,
        Key: storageKey,
        Fields: { 'Content-Type': contentType },
        Conditions: [
          ['content-length-range', 1, MAX_PHOTO_BYTES],
          ['eq', '$Content-Type', contentType],
        ],
        Expires: UPLOAD_URL_SECONDS,
      });
      const exifCapturedAt =
        typeof body.exifCapturedAt === 'string' && !Number.isNaN(Date.parse(body.exifCapturedAt))
          ? new Date(body.exifCapturedAt).toISOString()
          : undefined;
      const exifLocation = geoPointOf(body.exifLocation);
      await deps.repo.putPhoto({
        photoId,
        uploadedByAccountId: caller.accountId,
        kind: body.kind as PhotoKind,
        storageKey,
        contentType,
        sizeBytes: size as number,
        uploadStatus: 'pending',
        ...(exifCapturedAt ? { exifCapturedAt } : {}),
        ...(exifLocation ? { exifLocation } : {}),
        uploadedAt: acceptedAt.toISOString(),
        expiresAt: Math.floor(acceptedAt.getTime() / 1000) + PHOTO_TTL_SECONDS,
      });
      return json(
        201,
        {
          photoId,
          uploadUrl: post.url,
          uploadFields: post.fields,
          expiresInSeconds: UPLOAD_URL_SECONDS,
        },
        requestIdOf(event),
      );
    },

    'POST /v1/photos/{photoId}/complete': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter');
      const photoId = photoIdOf(event.pathParameters);
      const photo = await deps.repo.getPhoto(photoId);
      if (!photo) throw errors.notFound('写真が見つかりません');
      requireOwner(caller, photo.uploadedByAccountId);
      if (photo.uploadStatus === 'uploaded') {
        return json(200, { photoId, uploadStatus: 'uploaded' }, requestIdOf(event));
      }

      let head;
      try {
        head = await deps.s3.send(
          new HeadObjectCommand({ Bucket: deps.bucket, Key: photo.storageKey }),
        );
      } catch (err) {
        if (err instanceof Error && (err.name === 'NotFound' || err.name === 'NoSuchKey')) {
          throw errors.notFound('写真がまだアップロードされていません');
        }
        throw err;
      }
      const size = head.ContentLength ?? 0;
      if (
        size !== photo.sizeBytes ||
        size > MAX_PHOTO_BYTES ||
        head.ContentType !== photo.contentType
      ) {
        // 申告と違う写真は残さない
        await deps.s3.send(new DeleteObjectCommand({ Bucket: deps.bucket, Key: photo.storageKey }));
        throw errors.unprocessable('VALIDATION_FAILED', '写真の大きさか形式が違います', [
          { field: 'photo', reason: 'mismatch' },
        ]);
      }
      const uploadedAt = now();
      await deps.repo.markPhotoUploaded(photoId, uploadedAt.toISOString());

      let detection: DetectionOutcomeView | undefined;
      if (photo.kind === 'body') {
        // NFR12.5: 1 日 30 回を超えたら判別を呼ばず「判別できなかった」とする
        const allowed = await deps.rateLimiter.tryConsume(caller.accountId);
        const { result, rawLabels } = allowed
          ? await detectSpecies(deps.rekognition, deps.bucket, photo.storageKey)
          : { result: classifyServiceFailure('service-error' as const), rawLabels: undefined };
        detection = {
          outcome: result.outcome,
          species: result.species,
          confidence: result.confidence,
        };
        await deps.detectionRepo.put({
          detectionId: newId(),
          photoId,
          outcome: result.outcome,
          ...(result.species ? { species: result.species } : {}),
          ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
          ...(rawLabels ? { rawLabels } : {}),
          ...(result.failureReason ? { failureReason: result.failureReason } : {}),
          detectedAt: now().toISOString(),
          expiresAt: photo.expiresAt ?? Math.floor(uploadedAt.getTime() / 1000) + PHOTO_TTL_SECONDS,
        });
      }

      return json(
        200,
        {
          photoId,
          uploadStatus: 'uploaded',
          ...(detection ? { detection } : {}),
        },
        requestIdOf(event),
      );
    },
  };
}
