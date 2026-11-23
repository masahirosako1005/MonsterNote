// 報告の状態（C3 GET /v1/reviews/{reportId}）。
// BR3.5: ハンターは自分の報告の状態だけ（Review は自分の記録のハンターの ID で判断し、Reporting を呼ばない）。
import { getCaller, hasRole, requireOwner, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import { reviewNotReady, reviewView } from './decision';
import type { ReviewRepository } from './repository';

export function createGetReviewRoutes(deps: {
  repo: ReviewRepository;
}): Record<string, RouteHandler> {
  return {
    'GET /v1/reviews/{reportId}': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter', 'requester');
      const reportId = event.pathParameters?.reportId;
      if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);
      const record = await deps.repo.get(reportId);
      if (!record) throw reviewNotReady();
      if (!hasRole(caller, 'requester')) requireOwner(caller, record.hunterAccountId);
      return json(200, reviewView(record), requestIdOf(event));
    },
  };
}
