# Code Generation Plan — U3 `u3-review-list`

## Summary

- Builds: 却下・取り消し（10秒の猶予）・一覧の絞り込み（状態・印）・確認待ちの日数表示
- Touches: `backend/src/review/`（拡張）、`backend/src/catalog/`（拡張）、`backend/src/handlers/review.ts`・`catalog.ts`（拡張）、`infra/lib/api-stack.ts`（道を追加のみ、関数は既存のまま）、`frontend/requester/`（拡張）
- Tests: 約35件（単体22、結合8、E2E5）。Standard 戦略 ＋ feature スコープの行カバレッジ80%以上

## 1. プロジェクト構成（既存への追加）

- [x] Step 1: 新規ファイルはなし。既存の `backend/src/review/`・`backend/src/catalog/`（U1 で作成済み）に機能を追加する

## 2. テスト実行環境の確認

- [x] Step 2: 既存の `vitest.workspace.ts`・DynamoDB Local のヘルパーをそのまま使う。`ReviewDecisions`・`ReportListItems` の表の形は U1 のまま（項目を追加するだけ）であることを確認し、`npx vitest run backend/src/review` が通ることを確認する

## 3. データモデル／DB 層（Red→Green→Refactor）

対象の項目（entities.md のとおり、U1 では空のまま持っていた項目を本番にする）:

| 表 | 追加・本番化する項目 | 出典 |
|---|---|---|
| `ReviewDecisions` | `reason`・`reasonText`・`undoUntil` | entities.md、BR3.8・BR3.9 |
| `ReportListItems` | `duplicateSuspected`・`manualEntry` | entities.md、BR4.6 |

- [x] Step 3 (Red): `backend/src/review/repository.u3.test.ts`（既存ファイルに追記）に、`reason`・`reasonText`・`undoUntil` を含む読み書きの失敗するテストを書く
- [x] Step 4 (Green): `backend/src/review/repository.ts` を拡張する
- [x] Step 5 (Refactor): 項目名の定数化など、既存のコードと重複する部分を整理する

## 4. リポジトリ／データアクセス層（Red→Green→Refactor）

- [x] Step 6 (Red): 承認・却下・取り消しの条件付き書き換え（reliability-design.md §1 の `ConditionExpression`）の失敗するテストを `backend/src/review/decision.u3.test.ts`（既存ファイルに追記）に書く（却下の成功・409 ALREADY_DECIDED・取り消しの成功・403・409 UNDO_EXPIRED・409 ALREADY_UNDONE の各パターン）
- [x] Step 7 (Green): `backend/src/review/decision.ts` を拡張し、却下（`decision=rejected`）を受け付ける。`backend/src/review/undo.ts`（新規）に取り消しのロジックを実装する（`ConditionExpression: "status <> :checking AND decidedByAccountId = :acct AND undoUntil >= :now"`）
- [x] Step 8 (Refactor): 却下・取り消しで共通の「条件に合わなければ記録を読み直して理由を判定する」ロジックを共有する

## 5. 業務ロジック層（Red→Green→Refactor）

- [x] Step 9 (Red): 却下の理由の確認（4つの理由、`other` のとき1〜200文字必須。BR3.8）、絞り込みの判定（status・flag の組み合わせ。BR4.5）、`undoUntil` の絞り込み（本人かつ期限内だけ返す。BR3.15・NFR4.11）、「送ってから n 日」「7日以上」の計算（BR4.9）の失敗するテストを `backend/src/review/validate-reject.u3.test.ts`・`backend/src/catalog/filter.u3.test.ts`・`backend/src/review/undo-visibility.u3.test.ts`・`backend/src/catalog/days-elapsed.u3.test.ts`（新規）に書く
- [x] Step 10 (Green): 対応するロジックファイルを実装する
- [x] Step 11 (Refactor): 日数計算（24時間を1日として切り捨て）を `backend/src/shared/` の共通関数に切り出す

## 6. API／エンドポイント層（Red→Green→Refactor）

対象のルート（infrastructure-specification.md §2。`review`・`catalog` の既存の2関数に分けて追加する）: `PUT /v1/reviews/{reportId}/decision`（拡張。`review`）、`POST /v1/reviews/{reportId}/decision/undo`（新規。`review`）、`GET /v1/reviews/{reportId}`（拡張。`review`）、`GET /v1/catalog/reports`（拡張。`catalog`）、`GET /v1/catalog/my-reports`（拡張。`catalog`）。

- [x] Step 12 (Red): `backend/src/handlers/review.u3.test.ts`（既存ファイルに追記）・`backend/src/handlers/catalog.u3.test.ts`（既存ファイルに追記）に、却下・取り消し・絞り込みの応答の失敗するテストを書く
- [x] Step 13 (Green):
  - `backend/src/handlers/review.ts` を拡張し、`PUT /v1/reviews/{reportId}/decision` の `decision=rejected` 対応、`POST /v1/reviews/{reportId}/decision/undo`（新規の道）、`GET /v1/reviews/{reportId}` の `undoUntil` を条件付きで含める拡張を実装する
  - `backend/src/handlers/catalog.ts` を拡張し、`GET /v1/catalog/reports` の `status`・`flag`・`cursor` パラメータ対応、`GET /v1/catalog/my-reports` への `location`（緯度・経度）追加を実装する（D-2）
  - 取り消しの知らせ（`review.status-changed`）は、承認・却下と異なり **1 回だけ送信を試し、結果を待たず応答する**（performance-design.md・reliability-design.md §2 のとおり）
- [x] Step 14 (Refactor): `review`・`catalog` それぞれの IAM 境界（`review` は `ReviewDecisions` だけ、`catalog` は `ReportListItems` だけ）を壊さないよう、ハンドラの依存関係を確認する

## 7. フロントエンドの振る舞い層（Red→Green→Refactor）

- [x] Step 15 (Red): 却下の理由選択画面（4択＋その他の文字入力、1〜200文字）、取り消しボタン（10秒カウントダウン、サーバーの絶対時刻との差で計算。NFR7.5）、絞り込みの選択UI（複数選択可能なトグルボタン）、同時操作で弾かれたときの画面の出し直し（エラー表示にしない）の失敗するテストを `frontend/requester/src/pages/DetailPage.u3.test.tsx`・`frontend/ui-kit/src/components/UndoButton.u3.test.tsx`・`frontend/requester/src/pages/ListPage.u3.test.tsx`（既存ファイルに追記）に書く
- [x] Step 16 (Green): `frontend/requester/src/pages/DetailPage.tsx`（拡張。却下理由選択・取り消しボタン）、`frontend/ui-kit/src/components/UndoButton.tsx`（新規）、`frontend/requester/src/pages/ListPage.tsx`（拡張。絞り込みUI）を実装する
- [x] Step 17 (Refactor): カウントダウンの表示ロジックを U2 で作った `useTimeout`（あれば）と共通化できるか確認する

## 8. 環境・構成ファイル

- [x] Step 18: `infra/lib/api-stack.ts` に `POST /v1/reviews/{reportId}/decision/undo` の道を追加する（`review` 関数へ）。既存の `review`・`catalog` 関数のメモリ・時間切れ（128 MB・8秒）は変更しない
- [x] Step 19: `infra/test/stacks.u3.test.ts`（新規）で、`review`・`catalog` 関数のメモリ・時間切れが変わっていないこと、新しい道が正しい関数に紐づいていることを `aws-cdk-lib/assertions` で確認する

## 9. ドキュメントとトレーサビリティ

- [x] Step 20: `contracts/openapi.yaml` を更新する（D-1〜D-6 のとおり: 全件数の「これ以上ある」の印、`location` の追加、`reasonText` の長さ制約、`decidedByName` の置き換えの明記、`undoUntil` の追加、`409 ALREADY_UNDONE` の追加）
- [x] Step 21: `<record>/construction/u3-review-list/code-generation/code-summary.md`・`source-manifest.json`・`traceability.json` を作成する

## Assumptions

実装の途中で、承認済みの計画や設計文書が具体の手段を書き切っていなかった箇所が 2 つ見つかった。データモデルの新しい要素（entities.md にない表・項目）は追加していないが、念のためここに記録する（詳細は code-summary.md §5）。

- **`duplicate.suspected`（BR4.6・UC19）の受け手の配線**: infrastructure-specification.md は「新しい Lambda 関数・新しい表・新しい外部サービスを作らない」と明記しているが、どの既存の関数がこの知らせを受けるかという具体の EventBridge のルールは、U3 にも U2 の infrastructure-specification.md にも書かれていなかった（U2 は送り手側のルールだけを足していた）。logical-components.md の構成図（「duplicate.suspected は catalog 関数が受ける」）に沿い、新しい Lambda 関数を増やさずに**既存の** `catalogOnStatus` 関数を再利用し、関数の中で `envelope.type` を見て振り分けるようにした（`backend/src/handlers/consumers.ts`）。infra には新しい EventBridge のルール（`DuplicateSuspectedRule`）を 1 つだけ足した（新しい関数・表ではない）。
- **一覧の応答に `daysSinceSubmitted`・`waitingOverSevenDays` を足した**: entities.md は日数を「項目として持たない（読み出しのたびに計算する）」としているが、どこで計算するか（サーバーかフロントエンドか）は明記していなかった。functional-spec.md の UC18 手順 5 が `GET /v1/catalog/reports` 自身の処理として日数の計算を書いていること、および承認済み計画の Step 9〜10 が `backend/src/catalog/days-elapsed.ts`（バックエンドの業務ロジック）を名指していることから、サーバー側で計算し一覧の応答に含める実装とした。DynamoDB には保存しない（entities.md の制約どおり）。openapi.yaml にこの 2 項目を追記し、理由をコメントで残した。

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
