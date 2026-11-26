# Code Summary（作ったものの要約）— U4 `u4-accounts-admin`

入力: code-generation-plan.md（自分で作成。15ステップ＋§0・§0b）、unit-test-instructions.md、functional-design（functional-spec.md・rules.md・entities.md・frontend-components.md）・nfr-design・infrastructure-design/infrastructure-specification.md、`inception/contract-design/contract-summary.md`、U1〜U3 のコード。

**運用上の注記**: このUnitは、AI-DLCのswarmのバッチチェックポイントに関する既知のツールの不具合（docs/05-construction.md §17）のため、自動進行（`next`/swarm）を使わず、会話の中で直接・単独に進めた。TDD・設計レビュー・学習記録の手順は、これまでのUnitと同じ厳密さを保った。

## 1. 作ったもの（ファイル）

一覧は `source-manifest.json`（132ファイル）にある。

| 場所 | 中身 |
|---|---|
| `backend/src/accounts/` | `admin-counter.ts`（新規。有効な管理者の数）、`caller-status.ts`（新規。他の部品からのmustChangePassword確認）、`change-password.ts`・`consent.ts`・`hunter-number.ts`・`get-me.ts`（新規。初回の手続き）、`create-account.ts`・`password-reset.ts`・`set-status.ts`・`list-accounts.ts`（新規。管理者のアカウント管理）、`repository.ts`（拡張） |
| `backend/src/audit-log/` | `repository.ts`・`on-recorded.ts`・`list-entries.ts`（すべて新規。操作の記録） |
| `backend/src/catalog/`・`review/`・`duplicate-detection/`・`reporting/` | `delete-all.ts`（各新規。5つの削除の入口）。`reporting/submit.ts`・`review/decision.ts`・`review/undo.ts`・`duplicate-detection/on-saved.ts`（拡張。§0で見つけた欠落のaudit.recorded送信を追加） |
| `backend/src/settings/` | `update-settings.ts`（新規） |
| `backend/src/shared/` | `events.ts`（拡張。`AuditRecordedData`・`publishAuditRecorded`）、`http.ts`（拡張。`passwordGate`）、`require-password-changed.ts`（新規）、`password-gate-client.ts`（新規。他の部品からaccounts関数を呼ぶ） |
| `backend/src/handlers/` | `accounts.ts`（拡張）、`audit-log.ts`（新規）、`catalog.ts`・`review.ts`・`duplicate-detection.ts`・`reporting.ts`・`settings.ts`（拡張。削除の入口・passwordGateの配線） |
| `scripts/` | `create-account.ts`（拡張。`role=admin`を受け付ける） |
| `infra/lib/` | `data-stack.ts`（拡張。AdminCounter・AuditEntries）、`api-stack.ts`（拡張。AuditLog関数、5つの削除の入口、Cognito最小権限、EventBridge配線） |
| `infra/test/` | `stacks.u4.test.ts`（新規）、`stacks.u1〜u3.test.ts`（拡張。関数・表・道の数の更新） |
| `frontend/ui-kit/src/` | `components/PasswordChangeForm`・`ConsentPanel`・`HunterNumberForm`・`ProcedureFlow`・`AccountForm`・`AccountTable`・`TempPasswordPanel`・`SettingsForm`（拡張）・`AuditTable`・`DeleteConfirm`・`DeleteProgress`（すべて新規か拡張）、`api/me.ts`（新規）、`session/session.ts`・`SessionContext.tsx`（拡張。複数役割対応） |
| `frontend/requester/src/pages/admin/` | `AccountsPage`・`AccountCreatePage`・`AccountDetailPage`・`SettingsPage`・`AuditLogPage`・`DeleteAllPage`（すべて新規） |
| `frontend/hunter/src/`・`frontend/requester/src/` | `App.tsx`（拡張。`/procedure`等の道）、`pages/LoginPage.tsx`（拡張、のち修正。下記§4）、`pages/ProcedurePage.tsx`（新規） |
| `contracts/` | `openapi.yaml`（D-1〜D-8を反映）、`asyncapi.yaml`（`audit.recorded`を追加） |
| `e2e/` | `mock-api.ts`（拡張。U4の全ルート・アカウントの状態を追加）、`u4-accounts-admin.spec.ts`（新規。5シナリオ） |

## 2. 主な判断

- **mustChangePasswordの確認は内部の直接呼び出し（ADR-011パターンの再利用）**: accounts関数以外（review・catalog・duplicate-detection・settings）はAccountsの表を直接読めないため、ADR-011の`CallerForwarded`パターンを一般化した`caller-status`を新設し、`createHttpHandler`の`passwordGate`オプションから呼ぶ。新しい設計パターンを増やさず、既存の確立した仕組みを再利用した。
- **DynamoDBの条件付き書き込みはパーティションキー自身でしか判定できない**: `audit-log/on-recorded.ts`の初期実装はランダムなentryIdを生成しており、`attribute_not_exists(eventId)`の条件が実質無効だった（毎回別の行になり二重登録を防げない）。`entryId = envelope.eventId`に直してから気づき、実装前に修正した。
- **5つの削除の入口の名前と方式はinfrastructure-specification.mdに合わせた**: functional-spec.md（UC26）の原案は`DELETE`・`report-data`だったが、infrastructure-specification.mdは`POST`・`reporting-data`で決めていた。Code Generationの実装はinfrastructure-specification.mdに従い、人に確認のうえ原案側を訂正した（D-1、d60e400a）。

## 3. 試験の結果

`npm run verify`（format:check → lint → typecheck → test:coverage → test:e2e → synth）がすべて成功。

| 種類 | 件数 | 結果 |
|---|---|---|
| backend（U1〜U4、既存+新規） | 413件 | すべて成功 |
| frontend（ui-kit・hunter・requester） | 141件 | すべて成功 |
| CDKの構成の試験（stacks.u1〜u4） | 67件 | すべて成功 |
| 全体のテスト数 | 621件 | すべて成功 |
| 行カバレッジ（Lines） | 88.35%（全体。80%の床を満たす。Stmts 86.15%・Branch 79.57%・Funcs 81.69%） | — |
| E2E（Playwright、chromium + mobile-webkit） | 40件 | すべて成功。内訳: U1〜U3 既存30件＋**U4（初回手続き・アカウント作成・無効化・操作の記録・すべて削除の5シナリオ）×2ブラウザ=10件**（`e2e/u4-accounts-admin.spec.ts`） |
| `cdk synth` | — | 成功（5スタック・12関数・14表） |

## 4. この Unit で見つけ、直した不具合

実装の途中、および`npm run verify`の前に自分の作業を見直し、以下を見つけて直した（いずれも人に報告・承認のうえ修正）。

1. **重大: 管理者専用の11個のAPIすべてに`role=admin`のサーバー側確認が無かった。** `requireRole(caller, 'admin')`を一切呼んでいなかったため、ハンター・依頼元のアカウントでも管理者専用の道（アカウントの一覧・作成・無効化、設定、操作の記録、5つの削除の入口）を直接呼べる状態だった。全11ルートに追加し、各ルートに403のテストを足した（`code-generation-plan.md` §0b）。
2. **アカウントの作成・再設定・無効化／有効化の操作の記録が一切残っていなかった。** BR12.5が明記する対象操作だが、accounts関数にEventBridgeへの送信経路（環境変数・IAM権限）自体が無かった。配線を追加し、3操作すべてに`publishAuditRecorded`を足した。
3. **ログイン直後、初回の手続き（`/procedure`）が実際には一度も実行されていなかった。** `LoginPage.tsx`が`store.login()`のあとに`navigate('/procedure')`を呼ぶ一方、同じコンポーネントの宣言的なガード（`if (account) return <Navigate to="/" replace />`）がaccountの更新を受けて競合し、後者が勝って常にホームへ直接進んでしまっていた。単体試験（jsdom + msw + act()）ではこの競合が再現せず、実ブラウザのE2E（Playwright）で初めて気づいた。宣言的なガードの行き先を`/procedure`に変え、`onSubmit`側の`navigate`呼び出しを削除して競合そのものを無くした（hunter・requester両方のLoginPage.tsx）。
4. **「すべて削除」の確認画面が、管理者には開けない道で件数を数えようとしていた。** `DeleteAllPage.tsx`は`GET /v1/catalog/reports`（依頼元専用。BR4.2）を呼んでおり、管理者は403になって件数が常に0件と表示されていた。BR4.2を緩め、この道を管理者にも開いた（D-8。人に確認して決定。0ea1d331）。

いずれも、該当するE2Eシナリオまたは単体試験を書いて初めて表面化した欠陥であり、「テストを先に書く」規律がなければ見逃していた可能性が高い。

## 5. 承認済み計画からの逸脱・補足

なし。§0（audit.recordedの前提の誤り）・§0b（上記4件の自己発見の欠陥）はいずれも計画自体への追加であり、計画の対象外にした項目はない。

## 6. トレーサビリティ

`traceability.json` に 114 件（AC・BR・NFR）の対応を記録。すべて `OK`（Deferred なし）。
