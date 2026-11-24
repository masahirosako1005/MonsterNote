// 種類の自動判別のしきい値判定（BR6.1）。Rekognition の生のラベルから、クマ・イノシシ・シカの
// 確からしさのうち最大のものを求め、80% 以上なら「判別できた」とする。純粋関数（外部呼び出しなし）。
import type { DetectionFailureReason, DetectionOutcome, RawLabel, Species } from './repository';

export const CONFIDENCE_THRESHOLD = 80;

export interface ClassifyResult {
  outcome: DetectionOutcome;
  species?: Species;
  confidence?: number;
  failureReason?: DetectionFailureReason;
}

/** Rekognition のラベル名 → 3 種類。見つからない名前は無視する */
const SPECIES_LABEL_NAMES: Record<Species, string[]> = {
  bear: ['bear', 'black bear', 'brown bear', 'grizzly bear'],
  boar: ['boar', 'wild boar', 'pig', 'hog', 'warthog'],
  deer: ['deer', 'elk', 'reindeer', 'red deer', 'fawn'],
};

function speciesOf(labelName: string): Species | undefined {
  const lower = labelName.toLowerCase();
  for (const [species, names] of Object.entries(SPECIES_LABEL_NAMES) as [Species, string[]][]) {
    if (names.includes(lower)) return species;
  }
  return undefined;
}

/** BR6.1: 3 種類のうち確からしさが最も高いものが 80% 以上なら detected、未満・該当なしなら undetected */
export function classifyLabels(labels: RawLabel[]): ClassifyResult {
  let bestSpecies: Species | undefined;
  let bestConfidence = -1;
  for (const label of labels) {
    const species = speciesOf(label.name);
    if (!species) continue;
    if (label.confidence > bestConfidence) {
      bestSpecies = species;
      bestConfidence = label.confidence;
    }
  }
  if (!bestSpecies) return { outcome: 'undetected', failureReason: 'no-animal' };
  if (bestConfidence >= CONFIDENCE_THRESHOLD) {
    return { outcome: 'detected', species: bestSpecies, confidence: bestConfidence };
  }
  return { outcome: 'undetected', failureReason: 'low-confidence' };
}

/** BR6.3: サービスの失敗・時間切れも「判別できなかった」として返す */
export function classifyServiceFailure(reason: 'service-error' | 'timeout'): ClassifyResult {
  return { outcome: 'undetected', failureReason: reason };
}
