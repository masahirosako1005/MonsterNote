// 判別中の表示の試験（BR6.2〜BR6.4、NFR7.4: 3 秒で「判別できませんでした。手で選んでください」に切り替わる）
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DetectionWait } from './DetectionWait';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('DetectionWait', () => {
  it('active のときは「判別しています」を表示する', () => {
    render(<DetectionWait active />);
    expect(screen.getByTestId('detection-waiting')).toHaveTextContent('判別しています');
  });

  it('3 秒たっても active のままなら「判別できませんでした。手で選んでください」に切り替わる（NFR7.4）', () => {
    render(<DetectionWait active />);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId('detection-timeout')).toHaveTextContent(
      '判別できませんでした。手で選んでください',
    );
  });

  it('active でなければ何も表示しない', () => {
    render(<DetectionWait active={false} />);
    expect(screen.queryByTestId('detection-waiting')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detection-timeout')).not.toBeInTheDocument();
  });

  it('timeoutMs を渡せば、そのミリ秒で切り替わる', () => {
    render(<DetectionWait active timeoutMs={1000} />);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByTestId('detection-waiting')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('detection-timeout')).toBeInTheDocument();
  });
});
