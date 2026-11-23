// 写真の受け付け（C2 POST /v1/photos）とアップロードの完了（POST /v1/photos/{photoId}/complete）。
// BR2.2: JPEG・PNG・HEIC で 15 MB まで、アップロード用の URL は 5 分。
// BR2.9: 完了の知らせで、S3 に実物があり大きさと形式が申告どおりかを確かめる。違えば消して拒否する。
// NFR5.3: 署名付きの POST の条件（キー・内容の種類・content-length-range）を S3 が強制する。
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getCaller, requireOwner, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { PhotoContentType, PhotoKind, ReportingRepository } from './repository';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const UPLOAD_URL_SECONDS = 5 * 60;
const CONTENT_TYPES: readonly PhotoContentType[] = ['image/jpeg', 'image/png', 'image/heic'];
const KINDS: readonly PhotoKind[] = ['body', 'tail', 'chest'];

export interface PhotoDeps {
  repo: ReportingRepository;
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
        throw errors.unprocessable(
          'VALIDATION_FAILED',
          '写真は JPEG・PNG・HEIC で 15 MB までです',
          details,
        );
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
      await deps.repo.putPhoto({
        photoId,
        uploadedByAccountId: caller.accountId,
        kind: body.kind as PhotoKind,
        storageKey,
        contentType,
        sizeBytes: size as number,
        uploadStatus: 'pending',
        uploadedAt: acceptedAt.toISOString(),
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
      await deps.repo.markPhotoUploaded(photoId, now().toISOString());
      return json(200, { photoId, uploadStatus: 'uploaded' }, requestIdOf(event));
    },
  };
}
