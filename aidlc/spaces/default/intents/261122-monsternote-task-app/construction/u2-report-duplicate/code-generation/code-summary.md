# Code Generation Summary — U2 `u2-report-duplicate`

## 1. 作ったもの・変えたもの

全体の一覧は `source-manifest.json`（82ファイル）のとおり。主なまとまりは次の4つ。

### 1.1 種類の自動判別（SpeciesDetection）
- `backend/src/species-detection/repository.ts`・`classify.ts`・`rate-limit.ts`（新規）
- 全身の写真の `complete` 呼び出し（`backend/src/reporting/photos.ts`、拡張）の中で、Amazon Rekognition の `DetectLabels` を3秒で区切って呼び出し（BR6.3・NFR7.4）、しきい値80%以上で「判別できた」と判定する（`classify.ts`）
- 1日30回の呼び出し上限を `DetectionRateLimit` 表への `if_not_exists` を使ったアトミックな更新で実現（NFR12.5、scalability-design.md Q2）

### 1.2 送信前後の重複判定（DuplicateDetection）
- `backend/src/duplicate-detection/repository.ts`・`match.ts`・`response-shape.ts`・`pre-submit.ts`・`on-saved.ts`・`on-status.ts`・`list.ts`（新規）
- 送信前（`POST /v1/reports` の中から `backend/src/reporting/submit.ts` が Lambda 直接呼び出しで問い合わせる。C9・BR8.5）と、保存後（EventBridge `report.saved` を受けて `on-saved.ts` が再判定し、疑いがあれば `duplicate.suspected` を発行。BR8.4〜BR8.6）の2段構成
- `review.status-changed`（却下・却下の取り消し）を受けて `ReportFootprint.active` を出し入れする `on-status.ts` を追加（plan の Assumptions 参照。BR8.7・BR8.11）
- 応答は `species`・`capturedAt`・`distanceMeters`（100m単位に丸め）だけに絞り、相手の氏名・reportId は返さない（NFR5.7・BR7.3）

### 1.3 設定の読み出し（Settings）
- `backend/src/settings/repository.ts`・`validate.ts`・`internal.ts`（新規）
- 変更はU4のスコープのため、本Unitは読み出しのみ（`readSettings`）。呼び出し元の証明は2種類（BR9.1、ADR-011）: Reporting からは利用者の証明をそのまま転送（`CallerForwarded`）、DuplicateDetection からは部品の身元の証明（`ComponentIdentified`）。共通の型は `backend/src/shared/internal-invoke.ts` に集約
- 対象地域（`targetArea`）は `GET /v1/report-settings`（新規、`backend/src/reporting/report-settings.ts`）としてハンター向けに公開。Settings 関数自体は API の道を持たない（内部呼び出し専用）

### 1.4 報告の送信の拡張（Reporting）
- `backend/src/reporting/repository.ts`・`photos.ts`・`submit.ts`・`get-report.ts` を拡張し、全身・尻尾・胸の3枚の写真、成獣／幼獣、捕獲の方法、EXIF/手入力の撮影日時・場所、BR2.17/18（熊と胸の写真の整合）などU2の必須項目を検証する
- `confirmedNotDuplicate` フラグで、確認後の再送信は重複の問い合わせを省く（BR7.2）

### 1.5 インフラ（CDK）
- `infra/lib/data-stack.ts`: 5表追加（`DetectionResults`・`ReportFootprints`・`DuplicateSuspicions`・`Settings`・`DetectionRateLimits`）、GSI 2本（`speciesDay`・`byReportId`）、写真S3に1日のライフサイクルルール
- `infra/lib/api-stack.ts`: 4関数追加（`settings`・`duplicateDetection`・`duplicateDetectionOnSaved`・`duplicateDetectionOnStatus`）、新ルート2本、IAM（`rekognition:DetectLabels`、関数間の `grantInvoke`、`ReviewDecisions` への読み取り専用 grant）、EventBridge 既存ルールへのターゲット追加。CloudWatch の `LambdaErrorsAlarm` が11関数に増えて数式あたり10指標の上限を超えたため、`sumMetrics` で9個ずつの入れ子に分割するようリファクタした

### 1.6 フロントエンド（スコープを絞った拡張。plan Step 16 Assumptions 参照）
- 新規コンポーネント: `DetectionWait`・`ConfirmDuplicateDialog`・`MapPicker`（`frontend/ui-kit/`）、`useTimeout`（共通フック）
- 拡張: `PhotoPage.tsx`（判別結果の表示・次へボタン）、`SubmitPage.tsx`（地図での位置指定、重複確認ダイアログ）、`ChoicePage.tsx`（やめる確認）、`DetailPage.tsx`（依頼元: 重複の疑いの一覧表示）、`ReportDetail.tsx`（成獣／幼獣・捕獲の方法・全写真の表示）
- **スコープの境界**: 既存の3画面構成（PhotoPage→ChoicePage→SubmitPage）のみ拡張し、frontend-components.md が描く残り5画面（尻尾・胸の写真、成獣／幼獣、捕獲の方法、捕獲日時の手入力）は作っていない。バックエンドは完全な報告（全項目）の検証を完備しているが、今のフロントエンドの3画面はそれらの項目を集めないため、この画面から実際に送信すると BR2.17 の検証で拒まれる。残りの画面は次の作業に持ち越す

## 2. 開発中に見つけた不具合・ギャップとその対応

- **React Router の「やめる」操作のレース条件**（修正済み）: `clearDraft()` を先に呼んでから `navigate()` すると、画面がまだ古い状態で再描画され、`<Navigate>` ガードが先に発火してホームでなく写真画面に戻ってしまう潜在バグを発見。`navigate()` を先に呼び、`setTimeout(clearDraft, 0)` で下書きのクリアを次のティックに回す形に直した（`SubmitPage.tsx`・`PhotoPage.tsx`・`ChoicePage.tsx` の3箇所）
- **BR2.19（作成をやめる前の確認）の欠落**（修正済み）: `PhotoPage.tsx`・`ChoicePage.tsx` の「やめる」ボタンに確認ダイアログが一切なかった。`context.tsx` に `confirmDiscard()` を追加し、3画面すべてに配線した
- **AC2.9.4（依頼元の詳細画面への項目反映）の欠落**（修正済み）: `ReportDetail.tsx` が `ageClass`・`captureMethod` を表示しておらず、全身の写真しか出していなかった。項目と全写真の表示を追加した

## 3. 計画からの逸脱（未実装・先送り。すべて traceability.json に GAP/Deferred として記録）

- **NFR2.10・NFR12.6（重複判定の500件ページ上限・打ち切り）**: `findMatches` は1日あたり1ページ（最大100件）を読むのみで、DynamoDB の `LastEvaluatedKey` による複数ページ読み・500件での打ち切りは未実装。試験運用の規模（月50件未満の想定）では実害がないと判断したが、将来の運用規模の拡大時には対応が必要
- **NFR9.4（ビルド後のファイルサイズ800KB以下の自動計測）**: `npm run build:web` の出力を目視確認したのみで、閾値チェックの自動化はしていない
- **AC2.2.x/2.3.x/2.7.x/2.9.x/2.10.x の一部（フロントエンドの専用画面）**: 上記1.6のスコープの境界のとおり未実装
- **AC6.4.x（設定の変更UI）・AC7.1.x/7.2.x（US7.1・US7.2）**: U4・次の版に明示的に先送り（rules.md BR9.1、functional-design-questions.md Q1）

## 4. テスト結果

- 単体・結合テスト（DynamoDB Local 含む）: 368件、54ファイル、すべて成功
- 行カバレッジ: 94.85%（feature スコープの80%下限を満たす。対象は自作のアプリロジックのみ、CDK は対象外 — team.md のとおり）
- Lint（ESLint）・フォーマット（Prettier）・型チェック（tsc --strict）: すべてクリーン
- E2E（Playwright、chromium + mobile-webkit）: 20/20 成功
- `npm run verify`（format:check && lint && typecheck && test:coverage && test:e2e && synth）: 成功
- `cdk synth --quiet`: 11個の Lambda 関数すべてが esbuild で正しくバンドルされることを確認済み

テストを書いたが未実行のものはない（すべて成功している）。カバレッジ下限・品質目標はいずれも下げていない。

## 5. 主要な設計判断

- ADR-011 のパターンを `backend/src/shared/internal-invoke.ts` の `CallerForwarded`/`ComponentIdentified` 判別共用体として実装し、Settings・DuplicateDetection への内部呼び出しで共通化した
- 種類の判別は Reporting 関数の中（`photos.ts` の `complete` ハンドラ）で行い、専用の HTTP エンドポイントは作っていない（infrastructure-specification.md の設計どおり）
- Settings 関数は API の道を持たない内部呼び出し専用の関数とした（BR9.1）
- `DuplicateSuspicion` の `suspicionId` は `${reportId}#${matchedReportId}#${kind}` の向き付きのキーとし、`putSuspicionIfAbsent` の条件付き書き込みで BR8.6 の冪等性を実現した
