// HunterApp: ハンター用の画面（H1 ログイン → H2 ホーム → 写真 → 種類と雌雄 → 送信 → H8 送信完了）。
// 画面ごとに分けて読み込む（NFR9.2）。
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppFrame } from '@ui-kit/AppFrame';
import type { AppConfig } from '@ui-kit/config';
import { RequireSession } from '@ui-kit/session/SessionContext';
import { hunterTheme } from '@ui-kit/theme';
import { defaultDeps, HunterStateProvider, type HunterDeps } from './context';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const PhotoPage = lazy(() => import('./pages/PhotoPage').then((m) => ({ default: m.PhotoPage })));
const ChoicePage = lazy(() =>
  import('./pages/ChoicePage').then((m) => ({ default: m.ChoicePage })),
);
const SubmitPage = lazy(() =>
  import('./pages/SubmitPage').then((m) => ({ default: m.SubmitPage })),
);
const DonePage = lazy(() => import('./pages/DonePage').then((m) => ({ default: m.DonePage })));

export interface HunterAppProps {
  config: AppConfig;
  initialPath?: string;
  deps?: Partial<HunterDeps>;
}

export function HunterApp({ config, initialPath, deps }: HunterAppProps) {
  const guarded = (element: JSX.Element) => <RequireSession>{element}</RequireSession>;
  return (
    <AppFrame
      theme={hunterTheme}
      apiBaseUrl={config.apiBaseUrl}
      role="hunter"
      initialPath={initialPath}
    >
      <HunterStateProvider deps={{ ...defaultDeps, ...deps }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={guarded(<HomePage />)} />
          <Route path="/report/photo" element={guarded(<PhotoPage />)} />
          <Route path="/report/choice" element={guarded(<ChoicePage />)} />
          <Route path="/report/submit" element={guarded(<SubmitPage />)} />
          <Route path="/report/done" element={guarded(<DonePage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HunterStateProvider>
    </AppFrame>
  );
}
