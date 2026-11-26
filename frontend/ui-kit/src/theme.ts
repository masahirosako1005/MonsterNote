// UiKit の 2 つのテーマ（design-system-mapping、NFR7.1・NFR8.1）。画面ごとに上書きしない。
// ハンター用: 文字 20px・ボタン 64px（屋外・手袋・高齢の利用者）。職員用: 文字 16px・ボタン 48px。
import { createTheme, type Theme } from '@mui/material/styles';

const palette = {
  primary: { main: '#1B5E20', light: '#E8F5E9', contrastText: '#FFFFFF' },
  warning: { main: '#E65100' },
  error: { main: '#B71C1C' },
  success: { main: '#2E7D32' },
  info: { main: '#0D47A1' },
  text: { primary: '#1A1A1A' },
  background: { default: '#FFFFFF', paper: '#FFFFFF' },
};

function buildTheme(fontPx: number, buttonPx: number): Theme {
  const font = `${fontPx}px`;
  return createTheme({
    palette,
    typography: {
      fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
      body1: { fontSize: font },
      body2: { fontSize: font },
      button: { fontSize: font, textTransform: 'none' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { minHeight: buttonPx, fontSize: font },
        },
      },
      // U3: 絞り込み（FilterBar）のトグルボタンも、MuiButton と同じ寸法にする（NFR7.6）
      MuiToggleButton: {
        styleOverrides: {
          root: { minHeight: buttonPx, fontSize: font },
        },
      },
      MuiInputBase: {
        styleOverrides: { root: { fontSize: font } },
      },
    },
  });
}

export const hunterTheme = buildTheme(20, 64);
export const staffTheme = buildTheme(16, 48);
