// 一定時間たったら true に切り替わる純粋なフックの試験（判別待ちのタイムアウト処理の共通化）
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTimeout } from './useTimeout';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useTimeout', () => {
  it('active な間、timeoutMs たつと true になる', () => {
    const { result } = renderHook(() => useTimeout(true, 3000));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(2999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('active=false なら時間がたっても false のまま', () => {
    const { result } = renderHook(() => useTimeout(false, 3000));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });

  it('active が false に戻ると、true だった状態もリセットされる', () => {
    const { result, rerender } = renderHook(({ active }) => useTimeout(active, 3000), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });
});
