// 報告の送信（C2 POST /v1/reports）。
// 確かめる順番（functional-spec UC2）: 証明 → 送信のキー（BR2.6）→ 同意と従事者番号（BR2.1、C10）→ 写真（BR2.3）→ 項目（BR2.4）。
// 保存（報告・送信のキー・写真の reportId をトランザクションで）→ report.saved を最大 3 回送る → eventSent を「済み」（BR2.7・NFR10.3）。
import { randomUUID } from 'node:crypto';
import type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { InvokeCommand, type LambdaClient } from '@aws-sdk/client-lambda';
import { getCaller, requireRole, type Caller } from '../shared/auth';
import { errors, type ErrorDetail } from '../shared/errors';
import {
  createEnvelope,
  EventPublishError,
  publishEvent,
  withTimeout,
  type PublishOptions,
  type ReportSavedData,
} from '../shared/events';
import { json, parseJsonBody, requestIdOf, type RouteHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import type { EligibilityResponse } from '../accounts/eligibility';
import {
  isConditionFailure,
  type ReportingRepository,
  type ReportRecord,
  type Sex,
  type Species,
} from './repository';

/** 「作成中」の期限（reliability-design） */
export const SUBMISSION_LEASE_MS = 30_000;
/** C10 の時間切れ（contract-summary 2.3） */
export const ELIGIBILITY_TIMEOUT_MS = 2_000;

const SPECIES: readonly Species[] = ['bear', 'boar', 'deer'];
const SEXES: readonly Sex[] = ['male', 'female', 'unknown'];

export type EligibilityClient = (caller: Caller) => Promise<EligibilityResponse>;

/** Accounts の関数を Lambda の直接の呼び出しで呼ぶ（C10、NFR4.4）。2 秒で時間切れ、やり直さない */
export function createEligibilityClient(
  lambda: LambdaClient,
  functionName: string,
): EligibilityClient {
  return async (caller) => {
    const res = await withTimeout(
      lambda.send(
        new InvokeCommand({
          FunctionName: functionName,
          Payload: new TextEncoder().encode(
            JSON.stringify({
              kind: 'report-eligibility',
              accountId: caller.accountId,
              caller: { sub: caller.accountId, roles: caller.roles },
            }),
          ),
        }),
      ),
      ELIGIBILITY_TIMEOUT_MS,
    );
    if (res.FunctionError || !res.Payload) {
      throw new Error(`Accounts の呼び出しの失敗: ${res.FunctionError ?? 'empty payload'}`);
    }
    return JSON.parse(new TextDecoder().decode(res.Payload)) as EligibilityResponse;
  };
}

export interface SubmitDeps {
  repo: ReportingRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  eligibility: EligibilityClient;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
  publishOptions?: PublishOptions;
}

interface ValidatedFields {
  photoId: string;
  location: { lat: number; lng: number };
  species: Species;
  sex: Sex;
}

function isFiniteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function bodyPhotoIdOf(body: Record<string, unknown>): string | undefined {
  const photos = body.photos as { body?: unknown } | undefined;
  return typeof photos?.body === 'string' && photos.body.length > 0 ? photos.body : undefined;
}

/** BR2.4 の必須の項目 */
function validateFields(body: Record<string, unknown>, photoId: string): ValidatedFields {
  const details: ErrorDetail[] = [];
  if (!SPECIES.includes(body.species as Species))
    details.push({ field: 'species', reason: 'required' });
  if (!SEXES.includes(body.sex as Sex)) details.push({ field: 'sex', reason: 'required' });
  const loc = body.location as { lat?: unknown; lng?: unknown } | undefined;
  if (!loc || !isFiniteIn(loc.lat, -90, 90) || !isFiniteIn(loc.lng, -180, 180)) {
    details.push({ field: 'location', reason: 'required' });
  }
  if (details.length > 0) throw errors.validation(details);
  return {
    photoId,
    location: { lat: loc!.lat as number, lng: loc!.lng as number },
    species: body.species as Species,
    sex: body.sex as Sex,
  };
}

export function createSubmitRoutes(deps: SubmitDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  const inProgress = () =>
    errors.conflict('SUBMISSION_IN_PROGRESS', '送信を処理しています。少し待ってください', {
      retryAfterSeconds: 2,
    });

  /** report.saved を送り、送れたら eventSent を「済み」にする。3 回とも失敗したら 500 */
  async function publishSaved(report: ReportRecord, hunterName: string, requestId: string) {
    const envelope = createEnvelope<ReportSavedData>({
      type: 'report.saved',
      source: 'Reporting',
      actorAccountId: report.hunterAccountId,
      now,
      newId,
      data: {
        reportId: report.reportId,
        hunterAccountId: report.hunterAccountId,
        hunterName,
        species: report.species,
        capturedAt: report.capturedAt,
        location: report.location,
        manualEntry: false,
        submittedAt: report.submittedAt,
        bodyPhotoId: report.bodyPhotoId,
      },
    });
    try {
      await publishEvent(deps.eventBridge, deps.busName, envelope, deps.publishOptions);
    } catch (err) {
      if (err instanceof EventPublishError) {
        deps.logger.error('report.saved を送れなかった', {
          requestId,
          errorCode: 'EVENT_PUBLISH_FAILED',
          reportId: report.reportId,
          eventId: envelope.eventId,
        });
      }
      throw errors.internal('送れませんでした。もう一度お試しください');
    }
    await deps.repo.markReportEventSent(report.reportId);
  }

  async function eligibleHunter(caller: Caller) {
    const result = await deps.eligibility(caller);
    if ('error' in result) throw errors.forbidden();
    if (!result.eligible || !result.hunterNumber) {
      throw errors.unprocessable(
        'CONSENT_REQUIRED',
        '報告の前に、同意と従事者番号の登録が必要です',
      );
    }
    return { hunterNumber: result.hunterNumber, displayName: result.displayName ?? '' };
  }

  return {
    'POST /v1/reports': async (event) => {
      const caller = getCaller(event);
      requireRole(caller, 'hunter');
      const requestId = requestIdOf(event);
      const body = parseJsonBody(event);
      const submissionKey = body.submissionKey;
      if (
        typeof submissionKey !== 'string' ||
        submissionKey.length < 8 ||
        submissionKey.length > 128
      ) {
        throw errors.validation([{ field: 'submissionKey', reason: 'required' }]);
      }

      // BR2.6: 送信のキーを、ほかのどの確認よりも先に確かめる
      const existing = await deps.repo.getSubmissionKey(submissionKey);
      const nowDate = now();
      const lease = new Date(nowDate.getTime() + SUBMISSION_LEASE_MS).toISOString();
      if (existing) {
        if (existing.hunterAccountId !== caller.accountId) {
          throw errors.validation([{ field: 'submissionKey', reason: 'already-used' }]);
        }
        if (existing.state === 'saved' && existing.reportId) {
          const report = await deps.repo.getReport(existing.reportId);
          if (!report) throw errors.internal();
          if (!report.eventSent) {
            // 保存したが知らせを送れていない報告: 知らせを送り直す（表示名は Accounts から読み直す）
            const hunter = await deps.eligibility(caller);
            const hunterName = 'displayName' in hunter ? (hunter.displayName ?? '') : '';
            await publishSaved(report, hunterName, requestId);
          }
          return json(200, { reportId: report.reportId }, requestId);
        }
        const expired = (existing.leaseExpiresAt ?? '') <= nowDate.toISOString();
        if (!expired) throw inProgress();
        if (
          !(await deps.repo.acquireSubmissionKey(
            submissionKey,
            caller.accountId,
            lease,
            existing.leaseExpiresAt,
          ))
        ) {
          throw inProgress();
        }
      } else if (!(await deps.repo.acquireSubmissionKey(submissionKey, caller.accountId, lease))) {
        throw inProgress();
      }

      let report: ReportRecord;
      let hunterName: string;
      try {
        const hunter = await eligibleHunter(caller); // BR2.1
        hunterName = hunter.displayName;

        // BR2.3: 自分がアップロードを終えた、まだ結び付いていない写真
        const photoId = bodyPhotoIdOf(body);
        if (!photoId) throw errors.validation([{ field: 'photos.body', reason: 'required' }]);
        const photo = await deps.repo.getPhoto(photoId);
        if (
          !photo ||
          photo.uploadedByAccountId !== caller.accountId ||
          photo.uploadStatus !== 'uploaded' ||
          photo.reportId ||
          photo.kind !== 'body'
        ) {
          throw errors.unprocessable('VALIDATION_FAILED', '写真を使えません。撮り直してください', [
            { field: 'photos.body', reason: 'not-usable' },
          ]);
        }

        const fields = validateFields(body, photoId); // BR2.4
        const savedAt = now().toISOString();
        report = {
          reportId: newId(),
          submissionKey,
          hunterAccountId: caller.accountId,
          hunterNumber: hunter.hunterNumber,
          // BR2.5: 捕獲日時は Reporting が受け付けた時刻、場所は送信の時点のスマホの位置
          capturedAt: savedAt,
          capturedAtSource: 'device',
          location: fields.location,
          locationSource: 'device',
          species: fields.species,
          sex: fields.sex,
          submittedAt: savedAt,
          bodyPhotoId: fields.photoId,
          eventSent: false,
        };
        try {
          await deps.repo.saveReport(report);
        } catch (err) {
          if (isConditionFailure(err)) {
            throw errors.unprocessable(
              'VALIDATION_FAILED',
              '写真を使えません。撮り直してください',
              [{ field: 'photos.body', reason: 'not-usable' }],
            );
          }
          throw err;
        }
      } catch (err) {
        // 保存の前に失敗したら「作成中」を放し、画面の「もう一度」ですぐに送れるようにする
        await deps.repo.releaseSubmissionKey(submissionKey);
        throw err;
      }

      await publishSaved(report, hunterName, requestId);
      return json(201, { reportId: report.reportId }, requestId);
    },
  };
}
