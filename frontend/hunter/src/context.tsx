// ハンターの画面が持つ状態: 報告の作成中の内容（下書きは保存しない）と、試験で差し替える部品
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { resizeImage } from '@ui-kit/image/resize';
import { browserPosition, type GeoPoint } from '@ui-kit/components/LocationGate';
import type { AgeClass, CaptureMethod, Sex, Species } from '@ui-kit/labels';

export interface HunterDeps {
  resize: (file: Blob, maxEdge: number) => Promise<Blob>;
  getPosition: () => Promise<GeoPoint>;
  sleep: (ms: number) => Promise<void>;
}

export const defaultDeps: HunterDeps = {
  resize: resizeImage,
  getPosition: browserPosition,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** 報告の作成中の内容（frontend-components 3: 写真の ID、種類、雌雄、送信のキー） */
export interface Draft {
  photoId?: string;
  // U2（新規。Build and Testで発見: バックエンドは必須だが画面で一度も集めていなかった）
  tailPhotoId?: string;
  chestPhotoId?: string;
  /** クマで、胸の写真を撮らなかったとき true（BR2.17） */
  chestPhotoMissing?: boolean;
  species?: Species;
  sex?: Sex;
  ageClass?: AgeClass;
  captureMethod?: CaptureMethod;
  submissionKey?: string;
  /** 全身の写真の自動判別の結果（BR6.4。種類の選択をこの値で初期化する） */
  autoDetectionOutcome?: 'detected' | 'undetected';
  autoDetectedSpecies?: Species;
  autoDetectionConfidence?: number;
}

/** 送ったばかりで、まだ一覧に届いていない報告（UC2 の 8） */
export interface JustSubmitted {
  reportId: string;
  species: Species;
  submittedAt: string;
}

interface HunterState {
  deps: HunterDeps;
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  clearDraft: () => void;
  justSubmitted?: JustSubmitted;
  setJustSubmitted: (r: JustSubmitted | undefined) => void;
}

const HunterContext = createContext<HunterState | undefined>(undefined);

export function HunterStateProvider({ deps, children }: { deps: HunterDeps; children: ReactNode }) {
  const [draft, setDraftState] = useState<Draft>({});
  const [justSubmitted, setJustSubmitted] = useState<JustSubmitted>();
  // 消す処理は変わらない関数にする（完了の画面の効果が、下書きが変わるたびに動き直さないように）
  const clearDraft = useCallback(() => setDraftState({}), []);
  const value = useMemo<HunterState>(
    () => ({
      deps,
      draft,
      setDraft: (update) => setDraftState((d) => update(d)),
      clearDraft,
      justSubmitted,
      setJustSubmitted,
    }),
    [deps, draft, clearDraft, justSubmitted],
  );
  return <HunterContext.Provider value={value}>{children}</HunterContext.Provider>;
}

export function useHunter(): HunterState {
  const value = useContext(HunterContext);
  if (!value) throw new Error('HunterStateProvider の中で使ってください');
  return value;
}

/** 送信のキー（二重送信の防止。BR2.6） */
export function newSubmissionKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** BR2.19（U2）: 作成中にホームへ戻る前に確かめる。「消す」なら true */
export function confirmDiscard(): boolean {
  return window.confirm('写真と入力内容は消えます。よろしいですか？');
}
