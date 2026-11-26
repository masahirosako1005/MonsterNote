// 報告の状態（C3 GET /v1/reviews/{reportId}）。
// BR3.5: ハンターは自分の報告の状態だけ（Review は自分の記録のハンターの ID で判断し、Reporting を呼ばない）。
// BR3.14: 却下の理由はハンターにも見せる。BR3.15: 本人にだけ、期限内の undoUntil を返す。
import { getCaller, hasRole, requireOwner, requireRole } from '../shared/auth';
import { errors } from '../shared/errors';
import { json, requestIdOf, type RouteHandler } from '../shared/http';
import { reviewNotReady, reviewView } from './decision';
import type { ReviewRepository } from './repository';
import { canShowUndo } from './undo-visibility';

export interface GetReviewDeps {
  repo: ReviewRepository;
  now?: () => Date;
}

export function createGetReviewRoutes(deps: GetReviewDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  return {
    'GET /v1/reviews/{reportId}': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter', 'requester');
      const reportId = event.pathParameters?.reportId;
      if (!reportId) throw errors.validation([{ field: 'reportId', reason: 'required' }]);
      const record = await deps.repo.get(reportId);
      if (!record) throw reviewNotReady();
      if (!hasRole(caller, 'requester')) requireOwner(caller, record.hunterAccountId);
      const includeUndo = canShowUndo(record, caller.accountId, now().getTime());
      return json(200, reviewView(record, { includeUndo }), requestIdOf(event));
    },
  };
}
