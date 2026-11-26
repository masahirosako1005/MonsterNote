# Build and Test Summary

## 1. 全体のビルド状況・前提

- 全ワークスペース（`backend`・`frontend`・`infra`・`scripts`）とも `npm ci` 済みの状態からビルド成功（`vite build` × 2アプリ、`cdk synth` × 5スタック）。
- 前提: Node.js 22、Java 17以上（DynamoDB Local用）、Playwrightのブラウザ（chromium・webkit）インストール済み。AWSの認証情報は不要。

## 2. 生成したテストの種類の一覧

Test Strategy: **Standard**（`aidlc-state.md`）。

| ファイル | 生成したか |
|---|---|
| `build-instructions.md` | ✅（常時） |
| `integration-test-instructions.md` | ✅（Standard以上） |
| `performance-test-instructions.md` | — （Comprehensive限定。未生成） |
| `security-test-instructions.md` | — （Comprehensive限定。未生成） |
| `build-and-test-summary.md`（本書） | ✅（常時） |
| `test-results.md` | ✅（常時） |
| `cross-unit-traceability.md` | ✅（常時） |

## 3. プロジェクト・Unitごとのカバレッジの見込み

- プロジェクト全体の行カバレッジの床: **80%以上**（`backend/src`・`frontend/*/src`。`infra/`は対象外）。実測 **88%台**（Lines。`npm run test:coverage`、108ファイル・625件すべて成功。§5の修正でフロントエンドの試験を3件追加）。
- Unitごとの内訳は各Unitの`code-summary.md`に記録済み（U1: 約300件、U2: 約180件、U3: 約320件、U4: 約621件〈累積〉）。本ステージは新たにUnit単位のカバレッジ測定は行わない（プロジェクト全体の床がすべてのUnitのコードを含む1回の計測で足りるため。stage file Step 9の指示どおり）。

## 4. Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| COV-FLOOR | team.md Testing Posture・NFR13（requirements.md） | backend/src・frontend/*/srcの行カバレッジ80%以上 | 88.36%（Lines） | `npm run test:coverage`（v8。108ファイル・622件成功） | build-and-test | Met |
| CI-OBLIGATION | Testing Contract `obligations.scope_floor`「Run the selected tests in CI before merge.」 | CIで選んだテストをマージ前に実行 | まだ未実行（ci-pipelineステージは`aidlc-state.md`で`[ ]`＝これから） | `.github/workflows/ci.yml`はすでに存在し`npm run verify`と同じ内容を実行する構成だが、このステージの時点ではまだ「マージ前に実行した」という実績がない | ci-pipeline | N/A（理由: ci-pipelineはこの計画の後続ステージであり、まだ実行前のため） |
| BUILD-WEB | build-instructions.md | `vite build`（hunter・requester）成功 | 成功 | `npm run build:web`の出力（test-results.md §1） | build-and-test | Met |
| BUILD-SYNTH | infrastructure-specification.md（各Unit） | `cdk synth`成功（5スタック） | 成功。12関数バンドル | `npm run synth --workspace infra`の出力 | build-and-test | Met |
| U1-U4-UNIT-TESTS | 各Unitのunit-test-instructions.md | 各Unitの単体・結合・CDK構成試験がすべて成功 | 全14本のコマンドがすべて成功（test-results.md §2） | 各コマンドの実行結果 | build-and-test | Met |
| E2E-BROWSER | 各Unitのfunctional-spec（ハンター・依頼元の画面の流れ） | E2Eが実ブラウザで成功 | 成功。**40件**、chromium・mobile-webkit（WebKit系）の実ブラウザエンジンで実行。jsdom/Happy DOMではない | `npx playwright test`の出力（test-results.md §3） | build-and-test | Met |
| NFR4・NFR5（認可・情報保護の全体） | requirements.md NFR4・NFR5、各Unitのsecurity-requirements.md | 役割の確認・証明の検証・ログの許可リスト・データの最小化がすべて正しい | 各Unitの単体試験（403系・ログの出力確認）がすべて成功。U4のアーキテクチャレビュー（iteration 2・READY）で`role=admin`確認・NFR5.15〈仮パスワードの非保存〉を個別に確認済み | 上記コマンドの実行結果、U4コード生成レビュー（iteration 2） | build-and-test | Met |
| NFR6（秘密情報） | requirements.md NFR6 | AWSの認証情報・パスワード等をリポジトリに置かない | 該当なし | `git status --porcelain`での確認（test-results.md §4） | build-and-test | Met |
| NFR7（アクセシビリティ） | requirements.md NFR7、refined-mockups/accessibility-checklist.md | 文字20px以上・ボタン64px以上・重大なアクセシビリティ違反なし | E2E（`@axe-core/playwright`、実ブラウザ）で確認済み（skeleton.u1.spec.tsの2件） | `npx playwright test --grep @u1`の出力 | build-and-test | Met |
| NFR9.4（ハンター画面のビルド後サイズ） | u2-report-duplicate/nfr-requirements/performance-requirements.md | 800KB以下（圧縮後） | 約158KB（圧縮後の合計） | `npm run build:web`の出力（アセットサイズの一覧） | build-and-test | Met |
| NFR11・NFR12（保存期間・運用の制約。タグ・メモリ・ログ保存・スロットリング） | requirements.md NFR11・NFR12、各Unitのinfra/test/stacks.*.test.ts | タグ`Name=masahiro-<aws-service>-monsternote`、メモリ128〜256MB、ログ保存14日以内、APIスロットリング | すべてCDKの構成試験で確認済み（成功） | `npx vitest run infra/test/stacks.u{1,2,3,4}.test.ts`の出力（test-results.md §2） | build-and-test | Met |
| NFR2.x（p95応答時間。一覧・送信・承認・削除等） | 各Unitのperformance-design.md | 95%のリクエストが各目標時間以内（API Gatewayのp95、CloudWatchの実測） | **未測定**（dev環境への配置が前提のため、このステージでは測れない） | — | performance-validation | Unverified（配置後の実測が前提。後続ステージが所有） |
| NFR12.6（重複判定の読み出し500件上限＋打ち切りのログ） | u2-report-duplicate/nfr-requirements/scalability-requirements.md | 1回の判定で読むのは500件まで。超えたら「読めた範囲で判定した」とログに残す | **未実装**（`match.ts`は日ごとに100件のページを`duplicateWindowHours`の日数分読むだけで、合計の上限・打ち切りのログのどちらも無い。設定次第で500件を超えうる） | `backend/src/duplicate-detection/match.ts`・`repository.ts`のコード確認（本ステージでの新規発見） | build-and-test | Unverified（人に報告し、想定の利用規模〈月50件未満〉では発生しないとして記録だけに留める決定。4455bd0d） |
| 要件・ACトレーサビリティ（全体） | `aidlc engine sensor-traceability --stage build-and-test` | 定義されたFR・NFR・ACがすべて`covered`または`N/A` | 機械的な判定は**不合格**（46件未達）のままだが、その主因（画面構成の食い違いに伴う実装の欠落）は人に報告・承認のうえBuild and Test中に修正済み。残りは既知の繰越3件＋文書整合の抜け1件＋配置後実測2件 | `cross-unit-traceability.md`・`test-results.md` §7 | build-and-test | Unverified（機械的な判定はU1・U2の静的な記録を参照する仕組み上、今回の修正を反映できないため。実装自体は解決済み。詳細は`cross-unit-traceability.md`） |

`Pending`の行は残っていない（Step 9終了時点ですべて確定済み）。

## 5. 既知の制約・今回の新規の発見

1. **【解決済み。人に報告・承認のうえBuild and Test中に修正】承認済みのInteraction Spec（7〜8画面・各項目を個別に「直す」確認画面）と、実際に作られたハンターの報告作成の流れ（3画面）が食い違っており、調べた結果、画面構成だけでなく`ageClass`・`captureMethod`・`capturedAt`・`capturedAtSource`・`locationSource`・尻尾の写真・クマの胸の写真の収集が一度も実装されていなかった（実際のバックエンドへの送信は常に422で失敗する状態）。** `cross-unit-traceability.md` §1(a)・`test-results.md` §7に詳細。欠落項目はすべて実装し、画面構成（3画面）は正式な決定として承認し直した（承認ログ: baa12d2b、51877a19）。`npm run verify`で修正を確認済み。
2. **【新規発見・記録のみ】NFR12.6（重複判定の読み出し500件上限）が実装されていない。** `match.ts`に合計の上限も、打ち切り時のログも無い。人に報告し、想定の利用規模（月50件未満）では発生しないとして、記録だけに留める決定を得た（4455bd0d。修正は行わない）。
3. **（繰越・新規ではない）** ハンター向けの却下理由の画面（FR9.2・AC5.2.1〜3。H9）はU3で意図的に先送りされ、すでにtraceability.jsonにDeferredと記録済み。
4. **（繰越・新規ではない）** 重複の疑い「写真」（FR11.1）・「月の輪」（FR12.1）の検出は、inception時点で意図された低優先度／実現性ゲートの要件であり、U2のasyncapi.yamlのコメントで「U2はplace-timeだけ」と明記済み。
5. **（文書の整合の抜け。実装は正しい）** FR8.3（依頼元が重複の相手の写真を見比べられる）は、U2で後から決めたBR8.8・NFR5.7（相手の写真・ID・氏名は返さない。プライバシー設計）と矛盾したまま。実装はNFR5.7のとおり正しく、FR8.3側の文書が古い。
6. **（後続ステージの既定の繰越。新規ではない）** NFR2.x（p95応答時間）はdev環境への配置後の実測が前提で、`aidlc-state.md`のOperationフェーズに`performance-validation`が予定済み。

## 6. 読み出しの可否の判定（Readiness）

- **Build-ready**: はい。ビルド・`cdk synth`とも成功。
- **Test-ready（ローカルで確かめられる範囲）**: はい。単体・結合・CDK構成試験・E2E（実ブラウザ）はすべて成功、カバレッジの床も満たす。
- **Deployment-ready**: **いいえ、まだ**。CIパイプライン（ci-pipeline）がまだ実行されておらず、dev環境への配置も行っていない（project.mdのMandated: デプロイ前に必ず人に確認する）。配置後の性能実測（NFR2.x）も残っている。
- 上記「5. 既知の制約・今回の新規の発見」の1は解決済み（人に報告・承認のうえ修正済み）。2（NFR12.6）は人に報告し、想定の利用規模では発生しないとして記録だけに留める決定を得た（4455bd0d）。どちらも承認ゲートでの新たな保留事項ではない。

## 7. Loop-Back Log

なし。
