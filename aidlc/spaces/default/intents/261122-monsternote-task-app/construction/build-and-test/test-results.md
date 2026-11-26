# Test Results — Build and Test

## 1. ビルドの結果

| コマンド | 結果 |
|---|---|
| `npm run build:web`（vite build × hunter・requester） | 成功。両アプリとも `dist/` にアセットを出力 |
| `npm run synth --workspace infra`（`cdk synth`） | 成功。5スタック（Auth・Web・Data・Api・WebContent）を合成。12個のLambda関数をesbuildでバンドル（Accounts・AuditLog・Settings・DuplicateDetection・Reporting・Review・Catalog・ReviewOnSaved・CatalogOnSaved・CatalogOnStatus・DuplicateDetectionOnSaved・DuplicateDetectionOnStatus） |

## 2. 各Unitのunit-test-instructions.mdのコマンド（重複を除き、1回ずつ実行）

**注記（§7参照）**: 下表の#1・#4は、Build and Test中に見つけ直した欠陥（ハンターの報告の送信が、実際のバックエンドに対しては必須項目の不足で常に失敗していた）の修正を反映した、修正後の実測値。

| # | コマンド（Unit） | 結果 |
|---|---|---|
| 1 | `npx vitest run .u1.test.`（U1） | 成功。30ファイル・241件 |
| 2 | `npx playwright test --grep @u1`（U1） | 成功。12件（chromium 6 + mobile-webkit 6） |
| 3 | `npx vitest run backend/src/species-detection backend/src/duplicate-detection backend/src/settings backend/src/reporting backend/src/handlers/reporting.u2.test.ts backend/src/handlers/duplicate-detection.u2.test.ts backend/src/handlers/settings.u2.test.ts`（U2） | 成功。23ファイル・139件 |
| 4 | `npx vitest run frontend/hunter/src frontend/requester/src frontend/ui-kit/src --project frontend`（U2・U3・U4で同系統のコマンド。U4の`frontend --project frontend`が上位集合） | 成功。34ファイル・**144件**（§7の修正でクマの胸の写真の試験3件を追加） |
| 5 | `npx vitest run infra/test/stacks.u2.test.ts`（U2） | 成功。1ファイル・16件 |
| 6 | `npx playwright test e2e/u2-species-duplicate.spec.ts`（U2） | 成功。8件（chromium 4 + mobile-webkit 4） |
| 7 | `npx vitest run backend/src/review backend/src/catalog backend/src/handlers/review.u3.test.ts backend/src/handlers/catalog.u3.test.ts`（U3） | 成功。16ファイル・105件 |
| 8 | `npx vitest run frontend/requester/src frontend/ui-kit/src/components/UndoButton.u3.test.tsx --project frontend`（U3） | 成功。5ファイル・23件 |
| 9 | `npx vitest run infra/test/stacks.u3.test.ts`（U3） | 成功。1ファイル・13件 |
| 10 | `npx playwright test e2e/u3-reject-undo-filter.spec.ts`（U3） | 成功。10件（chromium 5 + mobile-webkit 5） |
| 11 | `npx vitest run backend/src/accounts backend/src/audit-log backend/src/shared/*.u4.test.ts backend/src/handlers/handlers.u4.test.ts`（U4） | 成功。21ファイル・109件 |
| 12 | `npx vitest run backend/src/catalog/delete-all.u4.test.ts backend/src/review/delete-all.u4.test.ts backend/src/duplicate-detection/delete-all.u4.test.ts backend/src/reporting/delete-all.u4.test.ts backend/src/settings/get-settings.u4.test.ts backend/src/settings/update-settings.u4.test.ts`（U4） | 成功。6ファイル・19件 |
| 13 | `npx vitest run infra/test/stacks.u4.test.ts`（U4） | 成功。1ファイル・9件 |
| 14 | `npx playwright test e2e/u4-accounts-admin.spec.ts`（U4） | 成功。10件（chromium 5 + mobile-webkit 5） |

いずれも失敗・スキップなし。#4は3つのUnitの同系統コマンドを代表して1回だけ実行（stage fileの重複排除の指示どおり）。

## 3. プロジェクト全体（`npm run verify`。1回・プロジェクトのルートから実行）

```
npm run verify
# = format:check && lint && typecheck && test:coverage && test:e2e && synth
```

| 工程 | 結果 |
|---|---|
| `format:check`（Prettier） | 成功 |
| `lint`（ESLint） | 成功 |
| `typecheck`（TypeScript、backend・frontend・infra・scripts・e2e の5プロジェクト） | 成功 |
| `test:coverage`（Vitest、backend+frontend+infraを1回で実行。プロジェクト全体のカバレッジの床〈80%〉の唯一の証拠） | 成功。**108ファイル・625件**すべて成功（§7の修正を反映）。カバレッジ（v8）: Stmts・Branch・Funcs・**Lines**とも80%の床を満たす（対象は`backend/src`・`frontend/*/src`。`infra/`は対象外） |
| `test:e2e`（Playwright） | 成功。**40件**（chromium 20 + mobile-webkit 20）。実行エンジン: 実ブラウザ（Chromium・WebKit系のmobile-webkitプロジェクト）。jsdom/Happy DOMではない — ブラウザの挙動（アクセシビリティ、ボタンの寸法、実際のfetch）を要する目標はこのE2Eで`Met`にできる |
| `synth`（`build:web` + `cdk synth`） | 成功 |

## 4. 補助的な確認（すべて成功）

| コマンド | 結果 |
|---|---|
| `npm audit --omit=dev` | `found 0 vulnerabilities`（project.mdのCorrectionsが求める水準） |
| `git ls-files infra/cdk.out \| wc -l` | `0`（ビルド成果物は追跡されていない。project.mdのCorrectionsどおり） |
| `git status --porcelain` での秘密情報らしきファイルの確認 | 該当なし |

## 5. カバレッジの床（プロジェクト全体）

- **床**: `backend/src`・`frontend/*/src`で行カバレッジ80%以上（`infra/`は対象外、CDKの構成はCDKの試験で確かめる。team.md・NFR13.1）。
- **実測**: Lines 88.36%（床を満たす）。既存のテスト件数を減らす、またはしきい値を下げる変更は行っていない。

## 6. Target Verification Matrix

`build-and-test-summary.md` に記載（本書と重複しないよう、判定の一覧はそちらにまとめた）。

## 7. Build and Test中に見つけ、直した重大な欠陥（人に報告・承認のうえ修正）

Step 10（要件トレーサビリティ）を実行する過程で、`cross-unit-traceability.md` §1(a)に記録した「承認済みの画面設計と実際の実装の食い違い」を調べ直したところ、設計上の簡略化の範囲を超えて、**ハンターが報告を送信する機能が、実際のバックエンドに対しては一度も成功しない状態**であることが分かった。

- U2でバックエンド（`backend/src/reporting/submit.ts`）は`POST /v1/reports`に`photos.tail`（尻尾の写真）・`ageClass`・`captureMethod`・`capturedAt`・`capturedAtSource`・`locationSource`を必須にし、クマは`photos.chest`か`chestPhotoMissing`のどちらかも必須にしたが、ハンター画面（`frontend/hunter/`）はこれらを一度も収集・送信していなかった（全身の写真1枚と種類・雌雄だけを送っていた）。
- 単体試験（MSWのモック）・E2E試験（`e2e/mock-api.ts`の手書きモック）のどちらも、この必須項目の有無を検証しておらず、この欠落は一度も表面化していなかった。実際のAWSへのデプロイ・実機試験はU1のスケルトン確認（U2より前）で止まっており、以降一度も行われていないことも一因。

人に報告し、「直ちに修正する」との判断を得て、Build and Testの中でその場で修正した（2回に分けて発見・修正。承認ログ: baa12d2b、51877a19）:

1. `ageClass`・`captureMethod`の選択を`ChoicePage`（2/3）に追加。`capturedAt`の手入力（既定は今の時刻）を`SubmitPage`（3/3）に追加。`capturedAtSource`・`locationSource`は画面がEXIFを読まないため常に`manual`を送るようにした。
2. 尻尾の写真の撮影を`PhotoPage`（1/3）に追加（全身の写真のあとに続けて撮る、同じ画面のサブステップ）。クマを選んだときだけ、胸の写真か「撮らなかった」のチェックボックスのどちらかを`ChoicePage`に追加（BR2.17・BR2.18）。
3. `e2e/mock-api.ts`に、本物のバックエンドと同じ必須項目の確認（422）を追加し、この種の欠落が二度と見過ごされないようにした。

修正後、該当するフロントエンドの単体試験に3件（クマの胸の写真の分岐）を追加し、既存の単体試験・E2E試験（ハンターの報告送信を経由するものすべて）を新しい画面の流れに合わせて更新した。`npm run verify`を再実行し、全工程の成功を確認した（§3）。

**承認済みの画面設計（Refined Mockups）との関係**: 元のInteraction Spec案（7〜8画面、各項目を個別に直せる確認画面）は、U4レビュー時の人の判断（51877a19のもう一方の質問で、3画面構成を正式な決定として承認し直す、を選択）により、**実際の3画面構成（写真→種類等→送信。各画面の中でサブステップとして項目を追加）を正とする**ことが決まった。元のInteraction Spec案は歴史的な記録として残し、直接の書き換えは行っていない（`cross-unit-traceability.md`に訂正の記録あり）。

## 8. Loop-Back Log

なし（失敗が発生していないため、エスカレーションのはしごは発動していない）。
