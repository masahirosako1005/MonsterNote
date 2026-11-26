// 重複の疑いの相手の一覧（C5 GET /v1/duplicates/{reportId}。BR8.9: 依頼元だけ）。
// 相手の報告の状態（確認中・承認・却下）も一緒に返す（D-6・BR8.8・Q7）。
import { getCaller, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import type { ReviewStatus } from '../review/repository';
import type { DuplicateRepository, SuspicionKind } from './repository';

export interface DuplicateMatchView {
  matchedReportId: string;
  kind: SuspicionKind;
  distanceMeters?: number;
  hoursApart?: number;
  /** BR3.7 と同じ考え方: 確認の記録がまだなければ「確認中」として扱う */
  matchedStatus: ReviewStatus;
}

export interface DuplicateListDeps {
  repo: DuplicateRepository;
  /** 相手の報告の状態を読む（Review の表。確認中・承認・却下） */
  getMatchedStatus: (reportId: string) => Promise<ReviewStatus>;
}

export function createDuplicateListRoutes(deps: DuplicateListDeps): Record<string, RouteHandler> {
  return {
    'GET /v1/duplicates/{reportId}': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'requester'); // BR8.9
      const reportId = event.pathParameters?.reportId;
      if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);

      const suspicions = await deps.repo.listSuspicionsByReport(reportId);
      const matches: DuplicateMatchView[] = await Promise.all(
        suspicions.map(async (s) => ({
          matchedReportId: s.matchedReportId,
          kind: s.kind,
          distanceMeters: s.distanceMeters,
          hoursApart: s.hoursApart,
          matchedStatus: await deps.getMatchedStatus(s.matchedReportId),
        })),
      );
      return json(200, { reportId, matches }, requestIdOf(event));
    },
  };
}
