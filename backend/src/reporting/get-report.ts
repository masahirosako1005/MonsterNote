// 報告の詳細（C2 GET /v1/reports/{reportId}）。
// BR2.8: ハンターは自分の報告だけ、依頼元はすべて。BR6.1: 写真は 15 分の表示用 URL（GET だけ）で見せる。
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCaller, hasRole, requireOwner, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { ReportingRepository } from './repository';

export const VIEW_URL_SECONDS = 15 * 60;

export interface GetReportDeps {
  repo: ReportingRepository;
  s3: S3Client;
  bucket: string;
}

export function createGetReportRoutes(deps: GetReportDeps): Record<string, RouteHandler> {
  return {
    'GET /v1/reports/{reportId}': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter', 'requester');
      const reportId = event.pathParameters?.reportId;
      if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);
      const report = await deps.repo.getReport(reportId);
      if (!report) throw errors.notFound('報告が見つかりません');
      if (!hasRole(caller, 'requester')) requireOwner(caller, report.hunterAccountId);

      const photo = await deps.repo.getPhoto(report.bodyPhotoId);
      const photos = photo
        ? [
            {
              photoId: photo.photoId,
              kind: photo.kind,
              url: await getSignedUrl(
                deps.s3,
                new GetObjectCommand({ Bucket: deps.bucket, Key: photo.storageKey }),
                { expiresIn: VIEW_URL_SECONDS },
              ),
              expiresInSeconds: VIEW_URL_SECONDS,
            },
          ]
        : [];

      return json(
        200,
        {
          reportId: report.reportId,
          hunterAccountId: report.hunterAccountId,
          hunterNumber: report.hunterNumber,
          species: report.species,
          sex: report.sex,
          capturedAt: report.capturedAt,
          capturedAtSource: report.capturedAtSource,
          location: report.location,
          locationSource: report.locationSource,
          submittedAt: report.submittedAt,
          photos,
        },
        requestIdOf(event),
      );
    },
  };
}
