// 重複の疑いの相手の一覧の試験（C5 GET /v1/duplicates/{reportId}。BR8.9・D-6）
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDuplicateListRoutes } from './list';
import { createDuplicateRepository } from './repository';
import type { ReviewStatus } from '../review/repository';
import { createHttpHandler } from '../shared/http';
import { createLogger } from '../shared/logger';
import { apiEvent, hunterClaims, requesterClaims } from '../../test/helpers/events';
import { clients } from '../../test/helpers/reporting';

const ddbMock = mockClient(DynamoDBDocumentClient);
const c = clients();
const repo = createDuplicateRepository(c.ddb, {
  footprints: 'ReportFootprints',
  suspicions: 'DuplicateSuspicions',
});

beforeEach(() => ddbMock.reset());

describe('GET /v1/duplicates/{reportId}', () => {
  const route = (getMatchedStatus = vi.fn(async (): Promise<ReviewStatus> => 'checking')) =>
    createHttpHandler(
      createDuplicateListRoutes({ repo, getMatchedStatus }),
      createLogger('duplicate-detection', () => undefined),
    );

  it('依頼元は疑いの一覧（相手・距離・時間差・状態）を読める（BR8.9）', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          suspicionId: 'r1#r2#place-time',
          reportId: 'r1',
          matchedReportId: 'r2',
          kind: 'place-time',
          distanceMeters: 300,
          hoursApart: 2,
          phase: 'post-save',
          detectedAt: 'x',
        },
      ],
    });
    const getMatchedStatus = vi.fn(async (): Promise<ReviewStatus> => 'rejected');
    const res = await route(getMatchedStatus)(
      apiEvent({
        routeKey: 'GET /v1/duplicates/{reportId}',
        claims: requesterClaims(),
        pathParameters: { reportId: 'r1' },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}') as {
      matches: { matchedReportId: string; matchedStatus: string }[];
    };
    expect(body.matches).toEqual([
      {
        matchedReportId: 'r2',
        kind: 'place-time',
        distanceMeters: 300,
        hoursApart: 2,
        matchedStatus: 'rejected',
      },
    ]);
    expect(getMatchedStatus).toHaveBeenCalledWith('r2');
  });

  it('ハンターは拒む（403）', async () => {
    const res = await route()(
      apiEvent({
        routeKey: 'GET /v1/duplicates/{reportId}',
        claims: hunterClaims(),
        pathParameters: { reportId: 'r1' },
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('疑いがなければ空の一覧', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const res = await route()(
      apiEvent({
        routeKey: 'GET /v1/duplicates/{reportId}',
        claims: requesterClaims(),
        pathParameters: { reportId: 'r1' },
      }),
    );
    expect(JSON.parse(res.body ?? '{}')).toEqual({ reportId: 'r1', matches: [] });
  });
});
