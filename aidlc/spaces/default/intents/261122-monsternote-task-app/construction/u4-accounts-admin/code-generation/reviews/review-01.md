## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T21:26:02Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | `backend/src/handlers/audit-log.ts` の `createHttpHandler` 呼び出し | BR11.4・security-design.md §1 は「`PUT /v1/me/password`・`GET /v1/me` 以外のすべての道」を、各関数の入口の共通ミドルウェア（mustChangePassword 確認）で拒むことを求めている。実際に `backend/src/handlers/accounts.ts`・`catalog.ts`・`reporting.ts`・`settings.ts`・`review.ts`・`duplicate-detection.ts` の6つの入口はすべて `passwordGate`（accountsは直接の関数、他5つは `createRemotePasswordGate`）を渡しているが、U4で新しく作った `backend/src/handlers/audit-log.ts` の `createHttpHandler({ 'GET /v1/admin/audit-entries': ... }, logger)` 呼び出しには `passwordGate` オプションが一切無い（grepで確認。他5ハンドラだけに `passwordGate:` の行がある）。結果として、`mustChangePassword=true` の管理者アカウントでも `GET /v1/admin/audit-entries` を呼べてしまい、BR11.4の「ほかに進ませない」という制約が、admin専用の新しい道1つだけ抜け落ちている。 | `backend/src/handlers/audit-log.ts` の `createHttpHandler` 呼び出しに、他の5つのハンドラと同じ仕組み（`passwordGate: createRemotePasswordGate(...)`、または `isPasswordGateExempt` の除外リストに明示的に載せる判断を人に確認したうえでの除外）を追加し、対応するテスト（mustChangePassword=trueで403になること）を足す。 | New |
| R-02 | Major | `aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/code-generation/unit-test-instructions.md` の「このUnitだけを動かすコマンド」 | 1本目のコマンドは `backend/src/shared/require-password-changed.u4.test.ts` だけを名指ししており、同じ `backend/src/shared/` に実在するU4の新規テスト3本（`batch-delete.u4.test.ts`・`events.u4.test.ts`・`password-gate-client.u4.test.ts`）がどのコマンドにも含まれていない（実際に `ls backend/src/shared/*.u4.test.ts` で4本を確認し、単独実行すると3本は成功する: `Test Files 3 passed (3) / Tests 8 passed (8)`）。さらに2本目のコマンドは `backend/src/handlers/settings.u4.test.ts` を指定しているが、このファイルは存在せず（`source-manifest.json`にも無い）、Vitestはエラーを出さずに黙ってそのパターンを無視する（実行結果: `Test Files 4 passed (4)` ＝5パターン中4ファイルのみ実行）。このため、ドキュメント通りに「このUnitだけ」を動かしても、新規に書いた3本のshared層テストが一度も走らず、かつ2本目のコマンドが1パターン分黙って抜けていることに気づけない。 | `unit-test-instructions.md`の2つのコマンドを、`backend/src/shared/`配下のU4新規テスト3本を含むように修正し、2本目の`settings.u4.test.ts`という存在しないパスを、実際のファイル（`backend/src/settings/update-settings.u4.test.ts`・`get-settings.u4.test.ts`）を指す形に直す。 | New |
| R-03 | Minor | `aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/code-generation/code-summary.md` > 「3. 試験の結果」の行カバレッジの数値 | `code-summary.md`は「行カバレッジ 86.17%」と書いているが、`npm run verify`を実際に動かした結果のv8カバレッジ要約は `Stmts 86.15 / Branch 79.57 / Funcs 81.69 / Lines 88.35`（%）であり、実際の行（Lines）カバレッジは88.35%、86.15%に近い数値はStmts（文）のカバレッジである。両方とも80%の床は満たしているため判定への影響は無いが、ラベルが実際の指標と食い違っている。 | 「行カバレッジ」として引用する数値を、v8レポートのLines列（88.35%）に合わせて修正するか、Stmts列を引用しているならその旨を明記する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npx vitest run backend/src/accounts backend/src/audit-log backend/src/shared/require-password-changed.u4.test.ts backend/src/handlers/accounts.u4.test.ts backend/src/handlers/audit-log.u4.test.ts` | PASS（`Test Files 17 passed (17) / Tests 93 passed (93)`） | 1本目のコマンド自体は成功するが、上記Major findingの通り`backend/src/shared/`の他3本のU4テストはこのコマンドにもどのコマンドにも含まれていない。 |
| `npx vitest run backend/src/catalog/delete-all.u4.test.ts backend/src/review/delete-all.u4.test.ts backend/src/duplicate-detection/delete-all.u4.test.ts backend/src/reporting/delete-all.u4.test.ts backend/src/handlers/settings.u4.test.ts` | PASS だが `Test Files 4 passed (4)`（5パターン中4ファイルのみ） | ブリーフで予告されていた通り、`backend/src/handlers/settings.u4.test.ts`は存在せず、Vitestはエラーなく黙ってそのパターンを無視した。実行結果は「成功」に見えるが、実際には1パターン分テストが走っていない。 |
| `npx vitest run frontend --project frontend` | PASS（`Test Files 34 passed (34) / Tests 141 passed (141)`） | code-summary.mdの「frontend 141件」と一致。 |
| `npx vitest run infra/test/stacks.u4.test.ts` | PASS（`Test Files 1 passed (1) / Tests 9 passed (9)`） | — |
| `npx playwright test e2e/u4-accounts-admin.spec.ts` | `npm run verify`内の`test:e2e`で確認。U4の5シナリオ×2ブラウザ=10件を含む全40件のE2Eがすべて成功（出力に`e2e/u4-accounts-admin.spec.ts`の5シナリオ×chromium/mobile-webkitの計10行の✓を確認）。 | code-summary.mdの主張と一致。 |
| `npm run verify`（format:check→lint→typecheck→test:coverage→test:e2e→synth、プロジェクトルートから実行） | 全ステップ成功。カバレッジ要約: `All files \| 86.15 \| 79.57 \| 81.69 \| 88.35`（Stmts/Branch/Funcs/Lines、%）。`cdk synth`成功（5スタック、ログに12個のLambda関数のバンドルを確認: Accounts・AuditLog・Settings・DuplicateDetection・Reporting・Review・Catalog・ReviewOnSaved・CatalogOnSaved・CatalogOnStatus・DuplicateDetectionOnSaved・DuplicateDetectionOnStatus）。 | 行カバレッジ88.35%は80%の床を満たす。全体として`npm run verify`はグリーンであり、Major findingの2点（passwordGateの抜け・unit-test-instructionsの不備）は`npm run verify`では検出されない種類の欠陥（カバレッジはクリアしているがアサーション自体が無い／ドキュメントの誤り）であることを裏付ける。 |

### Summary

コードベースは全体として丁寧に作られており、§0b・§0で自己発見した重大な欠陥（role=admin確認の欠落、audit.recordedの未配線、ログイン後の初回手続きの競合、DeleteAllPageのBR4.2閉塞）はいずれも実装を確認したところ正しく修正されている。AdminCounterの条件付き書き込み・5つの削除入口の順序と冪等性・on-recordedのeventId=entryIdによる重複排除も設計通りに実装されていた。しかし、同じ種類の欠陥（admin専用の新しい道に必須のアプリ層ゲートが1つ抜けている）がU4自身が新設した`audit-log.ts`ハンドラにもう1件残っており、さらにこのUnitの「動作確認の仕方」を定めた`unit-test-instructions.md`自体に、実在しないテストファイルを指す壊れたコマンドと、新規テスト3本を一切実行しないコマンドが残っている。後者はVitestが黙って無視するため気づきにくく、再発防止のためにも先に直す必要がある。
