// 却下の理由の確認（BR3.8）。4 つの理由から選び、「その他」のときは文（1〜200 文字）も必須。
// 空白だけの文は空として扱う。文字数は書記素（見た目の 1 文字）で数える。
import { errors } from '../shared/errors';

export const REJECT_REASONS = ['duplicate', 'insufficient-photo', 'out-of-scope', 'other'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export interface RejectInput {
  reason?: unknown;
  reasonText?: unknown;
}

export interface ValidRejection {
  reason: RejectReason;
  reasonText?: string;
}

const REASON_TOO_SHORT_OR_LONG = '理由を 1〜200 文字で入力してください';
const REASON_REQUIRED = '却下の理由を選んでください';

/** 書記素（見た目の 1 文字）で数える。絵文字や結合文字も 1 文字と数える */
function graphemeLength(value: string): number {
  const SegmenterCtor = (
    Intl as unknown as {
      Segmenter?: new (
        locale: string,
        opts: { granularity: string },
      ) => { segment(input: string): Iterable<unknown> };
    }
  ).Segmenter;
  if (SegmenterCtor) {
    const segmenter = new SegmenterCtor('ja', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value)).length;
  }
  return Array.from(value).length;
}

export function validateReject(input: RejectInput): ValidRejection {
  const reason = input.reason;
  if (typeof reason !== 'string' || !(REJECT_REASONS as readonly string[]).includes(reason)) {
    throw errors.unprocessable('VALIDATION_FAILED', REASON_REQUIRED, [
      { field: 'reason', reason: 'invalid' },
    ]);
  }
  if (reason !== 'other') return { reason: reason as RejectReason };

  const raw = input.reasonText;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  const length = graphemeLength(trimmed);
  if (length === 0 || length > 200) {
    throw errors.unprocessable('VALIDATION_FAILED', REASON_TOO_SHORT_OR_LONG, [
      { field: 'reasonText', reason: 'invalid' },
    ]);
  }
  return { reason: 'other', reasonText: trimmed };
}
