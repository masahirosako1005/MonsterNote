// 状態の読み出しで、本人にだけ取り消せる残り（undoUntil）を返すかどうか（BR3.15）
import { describe, expect, it } from 'vitest';
import { canShowUndo } from './undo-visibility';

const NOW = new Date('2026-11-23T04:00:05.000Z').getTime();

describe('canShowUndo', () => {
  it('本人かつ期限内なら true', () => {
    expect(
      canShowUndo(
        { decidedByAccountId: 'requester-a', undoUntil: '2026-11-23T04:00:10.000Z' },
        'requester-a',
        NOW,
      ),
    ).toBe(true);
  });

  it('ちょうど期限（undoUntil）でも true（以降は false）', () => {
    expect(
      canShowUndo(
        { decidedByAccountId: 'requester-a', undoUntil: '2026-11-23T04:00:05.000Z' },
        'requester-a',
        NOW,
      ),
    ).toBe(true);
  });

  it('本人以外は false（ボタンを出さない。AC4.5.3）', () => {
    expect(
      canShowUndo(
        { decidedByAccountId: 'requester-a', undoUntil: '2026-11-23T04:00:10.000Z' },
        'requester-b',
        NOW,
      ),
    ).toBe(false);
  });

  it('期限切れは false', () => {
    expect(
      canShowUndo(
        { decidedByAccountId: 'requester-a', undoUntil: '2026-11-23T04:00:04.000Z' },
        'requester-a',
        NOW,
      ),
    ).toBe(false);
  });

  it('undoUntil・decidedByAccountId が無ければ false（確認中の記録）', () => {
    expect(canShowUndo({}, 'requester-a', NOW)).toBe(false);
  });
});
