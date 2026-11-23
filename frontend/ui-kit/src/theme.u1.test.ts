// 2 つのテーマの試験（NFR7.1・NFR8.1: ハンター 文字 20px・ボタン 64px、職員 16px・48px、森の緑）
import { describe, expect, it } from 'vitest';
import { hunterTheme, staffTheme } from './theme';

const buttonRoot = (theme: typeof hunterTheme) =>
  theme.components?.MuiButton?.styleOverrides?.root as Record<string, unknown>;

describe('テーマ', () => {
  it('ハンター用は文字 20px・ボタンの高さ 64px', () => {
    expect(hunterTheme.typography.body1.fontSize).toBe('20px');
    expect(buttonRoot(hunterTheme).minHeight).toBe(64);
    expect(buttonRoot(hunterTheme).fontSize).toBe('20px');
  });

  it('職員用は文字 16px・ボタンの高さ 48px', () => {
    expect(staffTheme.typography.body1.fontSize).toBe('16px');
    expect(buttonRoot(staffTheme).minHeight).toBe(48);
  });

  it('どちらも主な色は森の緑、エラーは赤', () => {
    for (const theme of [hunterTheme, staffTheme]) {
      expect(theme.palette.primary.main).toBe('#1B5E20');
      expect(theme.palette.error.main).toBe('#B71C1C');
      expect(theme.palette.success.main).toBe('#2E7D32');
    }
  });
});
