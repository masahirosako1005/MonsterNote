// 状態の読み出しで、本人にだけ取り消せる残り（undoUntil）を返すかどうか（BR3.15）。
export interface UndoableRecord {
  decidedByAccountId?: string;
  undoUntil?: string;
}

export function canShowUndo(
  record: UndoableRecord,
  callerAccountId: string,
  nowMs: number,
): boolean {
  if (!record.decidedByAccountId || !record.undoUntil) return false;
  if (record.decidedByAccountId !== callerAccountId) return false;
  return nowMs <= new Date(record.undoUntil).getTime();
}
