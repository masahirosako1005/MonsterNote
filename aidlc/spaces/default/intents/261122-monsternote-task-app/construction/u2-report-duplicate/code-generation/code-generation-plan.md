# Code Generation Plan — U2 `u2-report-duplicate`

## Summary

- Builds: 種類の自動判別（Rekognition）、送信前後の重複判定、設定の読み出し（対象地域・重複の基準）
- Touches: `backend/src/species-detection/`・`backend/src/duplicate-detection/`・`backend/src/settings/`（新規）、`backend/src/reporting/`・`backend/src/handlers/reporting.ts`（拡張）、`infra/lib/data-stack.ts`・`infra/lib/api-stack.ts`（拡張）、`frontend/hunter/`・`frontend/requester/`・`frontend/ui-kit/`（拡張）
- Tests: 約45件（単体30、結合10、E2E5）。Standard 戦略（コンポーネントあたり5〜8件）＋ feature スコープの行カバレッジ80%以上

## Assumptions

- DetectionRateLimit の表は、NFR Design の scalability-design.md（Q2）が明記した `if_not_exists` を使ったアトミックな更新式の実装詳細であり、どの機能要件も個別には名指ししていないが、NFR12.5（1日30回の上限）を実現するために必要な技術的な補助データのため、このステップで作る（Step 5）。
- Step 19 は EventBridge の新しいルールとして `report.saved → duplicate-detection` だけを名指ししているが、unit-test-instructions が範囲とする rules.md は BR8.7・BR8.11（却下・却下の取り消しで `ReportFootprint.active` を出し入れする）も含む。この決まりは `review.status-changed` の知らせを DuplicateDetection が受けることを要るため、U1 で作った既存の `StatusChangedRule`（`review.status-changed` → `catalog-on-status`）の `targets` に `duplicate-detection` 関数を追加する（新しい Rule は作らない）。あわせて `backend/src/duplicate-detection/on-status.ts`・`backend/src/handlers/duplicate-detection-on-status.ts` を作る（Step 13 に含める。データモデルの新しい要素は増えない — 既存の `ReportFootprint.active`・`lastStatusEventAt` を使うだけ）。
- `GET /v1/duplicates/{reportId}` の応答に、疑いの相手の報告の状態（確認中・承認・却下。D-6・BR8.8・Q7）を含めるため、`duplicate-detection` 関数の IAM に U1 の `ReviewDecisions` 表への読み取り権限を追加する（infrastructure-specification.md の表には明記されていないが、functional-spec.md UC14 の手順 3 が要求する読み出しで、既存の表・項目を読むだけであり新しい データモデル要素は増えない）。

## 1. プロジェクト構成（既存への追加）

- [x] Step 1: `backend/src/species-detection/`・`backend/src/duplicate-detection/`・`backend/src/settings/` の3ディレクトリを新設する（U1 の `backend/src/reporting/`・`backend/src/review/` と同じ構成パターン: `repository.ts`・ロジックのファイル・`*.u2.test.ts`）

## 2. テスト実行環境の確認

- [x] Step 2: 既存の `vitest.workspace.ts`・`backend/test/helpers/` をそのまま使えることを確認する。DynamoDB Local に5つの新しい表（`DetectionResults`・`ReportFootprints`・`DuplicateSuspicions`・`Settings`・`DetectionRateLimits`）を足すヘルパーを `backend/test/helpers/tables.ts`（新規）に用意し、`npx vitest run backend/src/species-detection` のようなユニット単位のコマンドが通ることを確認する

## 3. データモデル／DB 層（Red→Green→Refactor）

対象の要素（nfr-design/entities.md・infrastructure-specification.md のとおり）:

| 要素 | 持ち主 | 項目 | 出典 |
|---|---|---|---|
| `DetectionResult` | SpeciesDetection | `detectionId`(PK)、`photoId`、`outcome`、`species`、`confidence`、`rawLabels`、`detectedAt`、`expiresAt`(TTL) | entities.md、NFR11.7 |
| `ReportFootprint` | DuplicateDetection | `reportId`(PK)、`species`、`location`、`capturedAt`、`active`、`photoHash` | entities.md |
| `DuplicateSuspicion` | DuplicateDetection | `suspicionId`(PK、`reportId#matchedReportId`)、`reportId`、`matchedReportId`、`kind`、`distanceMeters`、`hoursApart`、`phase`、`detectedAt` | entities.md、BR8.9 |
| `Setting` | Settings | `settingKey`(PK、固定値)、`duplicateDistanceMeters`、`duplicateWindowHours`、`targetAreaNorth/South/East/West`、`updatedByAccountId`、`updatedAt` | entities.md |
| `DetectionRateLimit` | Reporting（補助） | `accountId#date`(PK)、`callCount`、`ttl` | scalability-design.md Q2（Assumptions 参照） |

- [x] Step 3 (Red): `backend/src/species-detection/repository.u2.test.ts`・`backend/src/duplicate-detection/repository.u2.test.ts`・`backend/src/settings/repository.u2.test.ts` に、上表の各表への読み書き（作成・取得）の失敗するテストを書き、失敗の出力を記録する
- [x] Step 4 (Green): `backend/src/species-detection/repository.ts`・`backend/src/duplicate-detection/repository.ts`・`backend/src/settings/repository.ts` を実装し、テストを通す（U1 の `backend/src/shared/dynamo.ts` の薄いラッパーを再利用）
- [x] Step 5 (Refactor): 共通の TTL 計算・条件式の組み立てを `backend/src/shared/` に必要なら切り出す。整理後もテストが通ることを確認する

## 4. リポジトリ／データアクセス層（Red→Green→Refactor）

- [x] Step 6 (Red): `DetectionRateLimit` の `if_not_exists` を使ったアトミックな増加（scalability-design.md §1）の失敗するテストを `backend/src/species-detection/rate-limit.u2.test.ts` に書く（行がない最初の呼び出し・30 件目・31 件目の3パターン）
- [x] Step 7 (Green): `backend/src/species-detection/rate-limit.ts` を実装（`UpdateExpression: "SET callCount = if_not_exists(callCount, :zero) + :one"`、`ConditionExpression: "callCount < :limit OR attribute_not_exists(callCount)"`）
- [x] Step 8 (Refactor): 日付のキー（JST）の計算をテスト可能な純粋関数に分離する

## 5. 業務ロジック層（Red→Green→Refactor）

- [x] Step 9 (Red): 種類の判別のしきい値判定（80%以上で「判別できた」。BR6.3）、重複判定のハバーサイン距離計算（BR8.1〜BR8.3）、設定の値の範囲確認（BR9.2）、応答の項目の絞り込み（NFR5.7: `species`・`capturedAt`・`distanceMeters`〈100m単位〉だけを返す）の失敗するテストを、それぞれ `backend/src/species-detection/classify.u2.test.ts`・`backend/src/duplicate-detection/match.u2.test.ts`・`backend/src/settings/validate.u2.test.ts`・`backend/src/duplicate-detection/response-shape.u2.test.ts` に書く
- [x] Step 10 (Green): `classify.ts`・`match.ts`・`validate.ts`・`response-shape.ts` を実装する
- [x] Step 11 (Refactor): 重複判定の判定ロジック（送信前の問い合わせ・保存後の再判定で共通の部分）を `match.ts` 内で共有する

## 6. API／エンドポイント層（Red→Green→Refactor）

対象のルート（infrastructure-specification.md §2）: `POST /v1/photos/{id}/complete`（判別を追加）、`POST /v1/reports`（重複の問い合わせを追加）、`GET /v1/report-settings`（新規）、`POST /internal/v1/duplicate-checks`（Lambda 直接呼び出し、新規）、Settings 関数への内部呼び出し（ADR-011／利用者の証明）、EventBridge ルール `report.saved → duplicate-detection`（新規）。

- [x] Step 12 (Red): `backend/src/handlers/reporting.u2.test.ts`（既存ファイルに追記）に、判別結果を含む `complete` の応答、重複の疑いを含む `POST /v1/reports` の応答の失敗するテストを書く。`backend/src/handlers/duplicate-detection.u2.test.ts`・`backend/src/handlers/settings.u2.test.ts`（新規）に、それぞれのハンドラの失敗するテストを書く。`reporting.u2.test.ts` はこの Unit 以前には存在しなかったため新規作成とした
- [x] Step 13 (Green):
  - `backend/src/reporting/photos.ts` を拡張し、全身の写真の判別（Amazon Rekognition `DetectLabels`、3秒で区切る。BR6.3）と `DetectionRateLimit` の確認を追加する
  - `backend/src/reporting/submit.ts` を拡張し、送信前に `duplicate-detection` 関数を Lambda 直接呼び出しで問い合わせる処理（C9）を追加する。BR2.11〜BR2.20 の必須項目・写真・日時・場所の確認も合わせて実装した（完全な報告の送信は U2 の中心機能のため）
  - `backend/src/duplicate-detection/`・`backend/src/settings/` のハンドラロジックを実装する（`pre-submit.ts`・`on-saved.ts`・`on-status.ts`・`list.ts`・`internal.ts`）
  - `backend/src/handlers/duplicate-detection.ts`・`backend/src/handlers/settings.ts`（新規）、`backend/src/handlers/reporting.ts`（拡張。`GET /v1/report-settings`・`POST /v1/photos/{id}/complete` の判別・`POST /v1/reports` の重複確認を追加）、`backend/src/handlers/duplicate-detection-on-saved.ts`（新規。`report.saved` を受けて保存後の再判定）、`backend/src/handlers/duplicate-detection-on-status.ts`（新規。Assumptions 参照）を実装する
  - `GET /v1/duplicates/{reportId}` ハンドラ（`backend/src/duplicate-detection/`）を role=requester の確認付きで実装する（約束 C5）
- [x] Step 14 (Refactor): Settings 関数への呼び出しを、Reporting からは利用者の証明をそのまま転送、DuplicateDetection からは ADR-011 の部品の身元の証明で行う、という区別（infrastructure-specification.md §2）を `backend/src/shared/internal-invoke.ts` の共通の形（`CallerForwarded`・`ComponentIdentified`）として共通化した

## 7. フロントエンドの振る舞い層（Red→Green→Refactor）

- [x] Step 15 (Red): 判別中の表示（3秒で「判別できませんでした。手で選んでください」に切り替わる。NFR7.4）、重複の確認ダイアログ（「別の個体なので送る」ボタン）、地図の部品（キーボードでの緯度・経度の直接入力を併設。NFR7.3）の失敗するテストを `frontend/ui-kit/src/components/DetectionWait.u2.test.tsx`・`ConfirmDuplicateDialog.u2.test.tsx`・`MapPicker.u2.test.tsx`（新規）に書く
- [x] Step 16 (Green): 上記3つのコンポーネントと、`frontend/hunter/src/pages/PhotoPage.tsx`・`SubmitPage.tsx`（拡張。判別結果の表示、重複確認の組み込み。位置は MapPicker に置き換えた）、`frontend/requester/src/pages/DetailPage.tsx`（拡張。重複の疑いの相手の一覧表示、`GET /v1/duplicates/{reportId}` 呼び出し）を実装する。地図のタイルは OpenStreetMap の公式サーバーから直接取得する（infrastructure-design Q1-A）。**スコープの決定（Assumptions 参照）**: このステップは PhotoPage・SubmitPage・DetailPage の3ファイルの拡張だけを対象とし、frontend-components.md が描く残り5画面（尻尾・胸の写真、成獣／幼獣、捕獲の方法、捕獲日時の手入力の画面）は作っていない。既存の3画面の流れ（PhotoPage→ChoicePage→SubmitPage）は変えず、PhotoPage は判別結果の表示を追加、SubmitPage は MapPicker と重複確認ダイアログの組み込みのみ拡張した。この結果、今のハンターの画面は尻尾の写真・成獣／幼獣・捕獲の方法・捕獲日時を集めないため、実際にこの画面から送信すると、完全な報告を求めるバックエンドの検証（BR2.17）で拒まれる。バックエンドは完全な報告を正しく受け付け、そのテストも完備している。残りの画面を作るフロントエンドの拡張は、このUnitの明示された範囲の外として次の作業に残す。SubmitPage の「やめる」処理で、下書きを消す前に移動する順にしても `<Navigate>` のガードが再描画で先に効いてしまう既存のレースを発見し、`setTimeout` で移動のあとに下書きを消す形に直した（U1 からの潜在的な不具合。関連ファイルのため合わせて直した）
- [x] Step 17 (Refactor): 判別待ちのタイムアウト処理を `frontend/ui-kit/src/hooks/useTimeout.ts`（新規）として共通化する

## 8. 環境・構成ファイル

- [x] Step 18: `infra/lib/data-stack.ts` に5つの表（`DetectionResults`・`ReportFootprints`・`DuplicateSuspicions`・`Settings`・`DetectionRateLimits`）を追加し、`DetectionResults`・`DetectionRateLimits` に TTL 属性を設定する。写真の S3 にも 1 日のライフサイクルルールを追加した（scalability-design §3）
- [x] Step 19: `infra/lib/api-stack.ts` を拡張し、`duplicate-detection`・`settings`・`duplicate-detection-on-saved`・`duplicate-detection-on-status`（Assumptions 参照）の4つの Lambda 関数、新しい API の道（`GET /v1/report-settings`・`GET /v1/duplicates/{reportId}`）、`reporting` 関数の時間切れを8秒→9秒に変更、IAM に `rekognition:DetectLabels` を追加、EventBridge の既存の `ReportSavedRule`（report.saved）の受け手に `duplicate-detection-on-saved` を、既存の `StatusChangedRule`（review.status-changed）の受け手に `duplicate-detection-on-status` を追加した。アラームの指標が11関数に増えて CloudWatch の数式あたり10指標の上限を超えたため、`sumMetrics` で9個ずつの入れ子に分割する形にリファクタした（既存のLambdaErrorsAlarmの動作は変えない）
- [x] Step 20: `infra/test/stacks.u1.test.ts` に続く `infra/test/stacks.u2.test.ts`（新規）で、上記の CDK の構成（表・関数のメモリ/時間切れ・IAM の範囲・EventBridge のルール）を `aws-cdk-lib/assertions` で確認するテストを書く（CDK の構成の試験はカバレッジの対象外。team.md のとおり）。`stacks.u1.test.ts` の関数・表・道・IAM の個数の確認は、U2 で増えた数に合わせて更新した（ブラウンフィールドの変更）

## 9. ドキュメントとトレーサビリティ

- [x] Step 21: `contracts/openapi.yaml`・`contracts/asyncapi.yaml` を更新する（`POST /v1/photos` の応答に `uploadFields` は U1 で対応済み。U2 で `GET /v1/report-settings`・`GET /v1/duplicates/{reportId}` を追加し、`duplicate.suspected` の知らせを asyncapi に追加した。`POST /internal/v1/duplicate-checks` は Reporting→DuplicateDetection の Lambda 直接呼び出しで API Gateway の道に現れないため openapi.yaml には載せていない（infrastructure-specification.md §2 のとおり。画面向けの契約だけを openapi.yaml に書く既存の方針に合わせた））
- [x] Step 22: `<record>/construction/u2-report-duplicate/code-generation/code-summary.md`・`source-manifest.json`・`traceability.json` を作成する（Step 5・6 の指示どおり）

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "テストできる層（ドメインロジック、Lambda ハンドラ、フロントエンドの部品、CDK スタック）ごとに、先に失敗するテストを書いて実行し、そのテストを通す最小の実装を書き、テストが通ったまま整理する（Red → Green → Refactor）。",
  "scope": "feature",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Methodology evidence**: Q5 で人が「先にテストを書いてから実装する（TDD）」（B）を選んだ。判定ロジックだけを先に書く組み合わせ（C）や、実装のあとで書く形（A）は選ばれなかったため、すべてのテストできる層に同じ順番を当てる。\n- **Ordering**: テストできる層（ドメインロジック、Lambda ハンドラ、フロントエンドの部品、CDK スタック）ごとに、先に失敗するテストを書いて実行し、そのテストを通す最小の実装を書き、テストが通ったまま整理する（Red → Green → Refactor）。\n- **テストの場所の分け方**: [Q3][Q15]\n  - 手元のパソコン: 単体試験と、結合試験の一部。AWS のサービスはモック（代わりの部品）や DynamoDB Local で置き換える。AWS の費用はかからない。\n  - AWS の `dev`: 結合試験の残り（ログイン、写真の保存、種類の判別など、本物の AWS サービスを使うもの）と総合試験。デプロイの前には人が確認する。\n- **テストの道具**: 単体試験と結合試験は Vitest。CDK は `aws-cdk-lib/assertions` で、作られる構成の中身（`Name=masahiro-<aws-service>-monsternote` のタグ、Lambda のメモリ 128〜256 MB、ログの保存期間 14 日以内、API のスロットリング）を確かめる。E2E は Playwright。\n- **カバレッジ**: `feature` スコープの下限どおり **行カバレッジ 80% 以上**。対象は自分で書いたアプリのロジック（画面と API）とし、AWS の構成のコード（CDK）は割合の対象から外す。その代わり、CDK には上の「構成が正しいか」を確かめるテストを必ず書く。[Q6]\n- **CI**: GitHub Actions で、push と PR のたびに lint、型チェック、単体・結合テスト（手元と同じモック・DynamoDB Local を使うもの）、カバレッジ、E2E（下記）を動かす。どれかが失敗したら PR を取り込まない。CI は AWS に接続しない。\n- **E2E**: [Q7][Q16]\n  - push と PR のたびに、CI の中で AWS を使わずに動かす。画面を GitHub Actions の中で起動し、API はモックで置き換える。\n  - 本物の AWS を使う E2E は、人の確認のあと `dev` にデプロイしてから動かす。\n- **性能**: 無料枠を超えるおそれのある負荷試験はしない。数十リクエスト程度の確認にとどめる（project.md の Forbidden）。\n- Test Strategy（Standard）がテストの量と種類を決め、上の下限はそれに足されるだけで、減らすことはない。カバレッジの下限は、テストを通すために下げない。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:2957643b0a6d408228462c44830d5fae51b202ff853e7502b7dc4802047908db",
  "contract_sha256": "sha256:d7b37dee272ed91db48c7ee1e0477a5bc8daf31c9159c5d39d392a2040140325"
}
```
