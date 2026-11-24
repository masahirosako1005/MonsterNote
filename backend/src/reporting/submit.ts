// 報告の送信（C2 POST /v1/reports）。
// 確かめる順番（functional-spec UC9）: 送信のキー（BR2.6）→ 同意と従事者番号（BR2.1、C10）→
// 写真（BR2.3・BR2.14・BR2.17・BR2.18）→ 日時・場所（BR2.11・BR2.15・BR2.16）→ 重複（BR7.1・BR7.2）。
// 保存（manualEntry・自動判別の記録を入れる。BR2.12・BR2.20）→ report.saved を最大 3 回送る →
// eventSent を「済み」（BR2.7・NFR10.3）。
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
import type { SpeciesDetectionRepository } from '../species-detection/repository';
import { isWithinTargetArea } from '../settings/validate';
import type { DuplicateCheckClient, SettingsClient } from './internal-clients';
import {
  isConditionFailure,
  type AgeClass,
  type CaptureMethod,
  type FieldSource,
  type GeoPoint,
  type PhotoKind,
  type PhotoRecord,
  type ReportingRepository,
  type ReportRecord,
  type Sex,
  type Species,
} from './repository';

/** 「作成中」の期限（reliability-design） */
export const SUBMISSION_LEASE_MS = 30_000;
/** C10 の時間切れ（contract-summary 2.3） */
export const ELIGIBILITY_TIMEOUT_MS = 2_000;
/** BR2.14: 受け付けから 24 時間以内の写真だけ使える */
export const PHOTO_USABLE_MS = 24 * 60 * 60 * 1000;
/** BR2.15: 送信の時刻より 5 分を超えて未来は不可 */
export const CAPTURED_AT_FUTURE_MS = 5 * 60 * 1000;
/** BR2.15: 送信の時刻から 7 日より前は不可 */
export const CAPTURED_AT_PAST_MS = 7 * 24 * 60 * 60 * 1000;

const SPECIES: readonly Species[] = ['bear', 'boar', 'deer'];
const SEXES: readonly Sex[] = ['male', 'female', 'unknown'];
const AGE_CLASSES: readonly AgeClass[] = ['adult', 'juvenile'];
const CAPTURE_METHODS: readonly CaptureMethod[] = ['trap', 'gun', 'other'];
const FIELD_SOURCES: readonly FieldSource[] = ['exif', 'manual'];

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
  detectionRepo: SpeciesDetectionRepository;
  eventBridge: EventBridgeClient;
  busName: string;
  eligibility: EligibilityClient;
  /** BR2.16: 対象地域の確認（ADR-011 ①: 利用者の証明を転送） */
  settings: SettingsClient;
  /** BR7.1: 送信前の重複の問い合わせ（C9。ADR-011 ①: 利用者の証明を転送） */
  duplicateCheck: DuplicateCheckClient;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
  publishOptions?: PublishOptions;
}

interface ValidatedFields {
  bodyPhotoId: string;
  tailPhotoId: string;
  chestPhotoId?: string;
  chestPhotoMissing?: boolean;
  location: GeoPoint;
  locationSource: FieldSource;
  capturedAt: string;
  capturedAtSource: FieldSource;
  species: Species;
  sex: Sex;
  ageClass: AgeClass;
  captureMethod: CaptureMethod;
}

function isFiniteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function photoIdsOf(body: Record<string, unknown>): {
  body?: string;
  tail?: string;
  chest?: string;
} {
  const photos = body.photos as Record<string, unknown> | undefined;
  const idOf = (key: string) => {
    const v = photos?.[key];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  };
  return { body: idOf('body'), tail: idOf('tail'), chest: idOf('chest') };
}

/** BR2.11・BR2.17・BR2.18: 必須の項目がそろっているか（写真の実物の確認は別に行う） */
function validateFields(body: Record<string, unknown>): ValidatedFields {
  const details: ErrorDetail[] = [];
  const photoIds = photoIdsOf(body);
  if (!photoIds.body) details.push({ field: 'photos.body', reason: 'required' });
  if (!photoIds.tail) details.push({ field: 'photos.tail', reason: 'required' });

  const species = body.species as Species;
  if (!SPECIES.includes(species)) details.push({ field: 'species', reason: 'required' });
  const sex = body.sex as Sex;
  if (!SEXES.includes(sex)) details.push({ field: 'sex', reason: 'required' });
  const ageClass = body.ageClass as AgeClass;
  if (!AGE_CLASSES.includes(ageClass)) details.push({ field: 'ageClass', reason: 'required' });
  const captureMethod = body.captureMethod as CaptureMethod;
  if (!CAPTURE_METHODS.includes(captureMethod)) {
    details.push({ field: 'captureMethod', reason: 'required' });
  }

  const capturedAt = body.capturedAt;
  const capturedAtSource = body.capturedAtSource as FieldSource;
  const capturedAtOk =
    typeof capturedAt === 'string' &&
    !Number.isNaN(Date.parse(capturedAt)) &&
    FIELD_SOURCES.includes(capturedAtSource);
  if (!capturedAtOk) details.push({ field: 'capturedAt', reason: 'required' });

  const loc = body.location as { lat?: unknown; lng?: unknown } | undefined;
  const locationSource = body.locationSource as FieldSource;
  const locationOk =
    loc !== undefined &&
    isFiniteIn(loc.lat, -90, 90) &&
    isFiniteIn(loc.lng, -180, 180) &&
    FIELD_SOURCES.includes(locationSource);
  if (!locationOk) details.push({ field: 'location', reason: 'required' });

  const chestPhotoMissing = body.chestPhotoMissing === true;
  if (species === 'bear' && !photoIds.chest && !chestPhotoMissing) {
    // BR2.17: クマは胸の写真か「胸の写真なし」のどちらかが必須
    details.push({ field: 'photos.chest', reason: 'required' });
  }
  if (species !== 'bear' && photoIds.chest) {
    // BR2.18: クマ以外に胸の写真は結び付けられない
    details.push({ field: 'photos.chest', reason: 'not-allowed' });
  }

  if (details.length > 0) throw errors.validation(details);

  return {
    bodyPhotoId: photoIds.body!,
    tailPhotoId: photoIds.tail!,
    chestPhotoId: photoIds.chest,
    chestPhotoMissing: species === 'bear' ? chestPhotoMissing : undefined,
    location: { lat: (loc as { lat: number }).lat, lng: (loc as { lng: number }).lng },
    locationSource,
    capturedAt: new Date(capturedAt as string).toISOString(),
    capturedAtSource,
    species,
    sex,
    ageClass,
    captureMethod,
  };
}

/** BR2.15: 捕獲日時が送信の時刻から見て未来 5 分・過去 7 日の範囲か（境界は含む） */
function validateCapturedAtWindow(capturedAt: string, nowDate: Date): void {
  const t = Date.parse(capturedAt);
  if (t > nowDate.getTime() + CAPTURED_AT_FUTURE_MS) {
    throw errors.unprocessable('CAPTURED_AT_IN_FUTURE', '捕獲日時が未来です');
  }
  if (t < nowDate.getTime() - CAPTURED_AT_PAST_MS) {
    throw errors.unprocessable('CAPTURED_AT_TOO_OLD', '捕獲日時が 7 日より前です');
  }
}

export function createSubmitRoutes(deps: SubmitDeps): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  const inProgress = () =>
    errors.conflict('SUBMISSION_IN_PROGRESS', '送信を処理しています。少し待ってください', {
      retryAfterSeconds: 2,
    });

  /** BR2.3・BR2.14: 自分がアップロードを終えた、まだ結び付いていない 24 時間以内の写真 */
  async function usablePhoto(
    photoId: string,
    kind: PhotoKind,
    caller: Caller,
    nowDate: Date,
  ): Promise<PhotoRecord> {
    const photo = await deps.repo.getPhoto(photoId);
    const usable =
      photo !== undefined &&
      photo.uploadedByAccountId === caller.accountId &&
      photo.uploadStatus === 'uploaded' &&
      !photo.reportId &&
      photo.kind === kind;
    if (!usable) {
      throw errors.unprocessable('VALIDATION_FAILED', '写真を使えません。撮り直してください', [
        { field: `photos.${kind}`, reason: 'not-usable' },
      ]);
    }
    if (nowDate.getTime() - Date.parse(photo.uploadedAt) > PHOTO_USABLE_MS) {
      throw errors.unprocessable(
        'VALIDATION_FAILED',
        '写真の期限が切れています。撮り直してください',
        [{ field: `photos.${kind}`, reason: 'expired' }],
      );
    }
    return photo;
  }

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
        manualEntry: report.manualEntry,
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
        const fields = validateFields(body); // BR2.11・BR2.17・BR2.18

        // BR2.3・BR2.14: 写真の実物を確かめる（全身 → 尻尾 → 胸の順）
        await usablePhoto(fields.bodyPhotoId, 'body', caller, nowDate);
        await usablePhoto(fields.tailPhotoId, 'tail', caller, nowDate);
        if (fields.chestPhotoId) await usablePhoto(fields.chestPhotoId, 'chest', caller, nowDate);

        validateCapturedAtWindow(fields.capturedAt, nowDate); // BR2.15

        // BR2.16: 対象地域の確認（Settings を利用者の証明で読む）
        const settings = await deps.settings(caller);
        if (!isWithinTargetArea(fields.location, settings)) {
          throw errors.unprocessable('OUTSIDE_TARGET_AREA', '対象地域の外です');
        }

        // BR7.1・BR7.2: 確かめ済みでなければ、送信の前に重複の疑いを問い合わせる
        const confirmedNotDuplicate = body.confirmedNotDuplicate === true;
        if (!confirmedNotDuplicate) {
          const duplicate = await deps.duplicateCheck(caller, {
            species: fields.species,
            capturedAt: fields.capturedAt,
            location: fields.location,
          });
          if (duplicate.suspected) {
            throw errors.conflict('DUPLICATE_SUSPECTED', '近くで同じ種類・時期の報告があります', {
              matches: duplicate.matches,
            });
          }
        }

        // BR2.20: 自動判別の結果（判別できなかったことを含む）を記録する
        const detection = await deps.detectionRepo.getByPhotoId(fields.bodyPhotoId);
        const autoDetectionOutcome = detection?.outcome ?? 'undetected';

        const savedAt = nowDate.toISOString();
        report = {
          reportId: newId(),
          submissionKey,
          hunterAccountId: caller.accountId,
          hunterNumber: hunter.hunterNumber,
          capturedAt: fields.capturedAt,
          capturedAtSource: fields.capturedAtSource,
          location: fields.location,
          locationSource: fields.locationSource,
          // BR2.12: 日時か場所のどちらかが手入力なら手入力の印
          manualEntry: fields.capturedAtSource === 'manual' || fields.locationSource === 'manual',
          species: fields.species,
          ...(detection?.species ? { autoDetectedSpecies: detection.species } : {}),
          autoDetectionOutcome,
          ...(detection?.confidence !== undefined
            ? { autoDetectionConfidence: detection.confidence }
            : {}),
          sex: fields.sex,
          ageClass: fields.ageClass,
          captureMethod: fields.captureMethod,
          ...(fields.chestPhotoMissing !== undefined
            ? { chestPhotoMissing: fields.chestPhotoMissing }
            : {}),
          confirmedNotDuplicate,
          submittedAt: savedAt,
          bodyPhotoId: fields.bodyPhotoId,
          tailPhotoId: fields.tailPhotoId,
          ...(fields.chestPhotoId ? { chestPhotoId: fields.chestPhotoId } : {}),
          eventSent: false,
        };
        hunterName = hunter.displayName;
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
