# Code Generation Plan — U1 `u1-skeleton`（最初の細い版）

## Summary

- Builds: 最初の細い版（ログイン → 写真 1 枚の報告 → 依頼元が承認 → ハンターの一覧）の API・画面・CDK と、リポジトリの土台（npm workspaces、検査、CI）
- Touches: `package.json`・`backend/`・`frontend/`・`infra/`・`scripts/`・`.github/workflows/ci.yml`・`.gitignore`（足すだけ）
- Tests: Vitest の単体・結合 約 95 件（関数・ドメイン・画面の部品）、CDK の構成の試験 約 25 件、Playwright の E2E（API はモック）6 件、本物の AWS のスモーク 7 手順

入力: `construction/u1-skeleton/functional-design/`（entities・rules BR1.1〜BR6.1・functional-spec UC1〜UC7・frontend-components）、`construction/u1-skeleton/nfr-requirements/`・`nfr-design/`・`infrastructure-design/`、`inception/contract-design/contract-summary.md`（C1〜C4・C10・C12・C13・C16）、`inception/units-generation/unit-of-work.md`、`inception/requirements-analysis/requirements.md`、`inception/user-stories/stories.md`（US1.1・US2.1・US4.1・US4.2・US4.3・US5.1）。

テストの進め方: team.md の Testing Posture（**TDD**: テストできる層ごとに Red → Green → Refactor）。各層の Red は「先に失敗するテストを書き、`unit-test-instructions.md` のコマンドで失敗を確かめる」。

既存のファイル: `.gitignore` は人のファイルのため、**足すだけ**（`node_modules/`・`cdk.out/`・`coverage/`・`dist/`・`.env*`・`playwright-report/`・`test-results/` の行を足す。秘密情報のコミットを防ぐため。project.md）。`docs/`・`.mcp.json`・`新規 テキスト ドキュメント.txt` は変えない。

## Step 0: テストの準備（Red の前に、テストが動く状態にする）

- [x] Step 1: ルートの `package.json`（npm workspaces: `backend`・`frontend`・`infra`、Node.js 22、スクリプト `verify`・`smoke`・`test:u1`・`lint`・`typecheck`・`format:check`）、`tsconfig.base.json`（strict）、`eslint.config.js`（typescript-eslint、`react/no-danger` で `dangerouslySetInnerHTML` を禁止）、`.prettierrc`、`vitest.workspace.ts`（3 つのプロジェクト、カバレッジは v8・行 80% を全体で）、`.gitignore` に行を足す。`npx vitest run .u1.test` が「テストがない」で終わることを確かめる — US1.1（土台）、NFR13.1・NFR13.2・NFR6.1

## Step 1: 共通の処理（backend/src/shared）

- [x] Step 2 (Red): `auth.u1.test.ts` — 証明の claims（`sub`・`cognito:groups`）から役割と ID を読む、役割が足りないと 403、持ち主でないと 403 — BR1.2・BR1.4・NFR4.3（AC1.1.4・AC5.1.3）
- [x] Step 3 (Green → Refactor): `shared/auth.ts`（`requireRole`・`requireOwner`）
- [x] Step 4 (Red): `logger.u1.test.ts`（出してよい項目だけを JSON で出す、氏名・位置・従事者番号・トークン・URL を出さない）、`errors.u1.test.ts`（共通のエラーの形 `code`・`message`・`details`・`conflict`、状態番号）、`events.u1.test.ts`（EventEnvelope を作る、EventBridge への送信を 3 回まで 0.1・0.2 秒の間隔でやり直す、失敗で例外）— NFR5.5・contract-summary 2.2・2.4・reliability-design
- [x] Step 5 (Green → Refactor): `shared/logger.ts`・`shared/errors.ts`・`shared/events.ts`・`shared/http.ts`（API Gateway の応答とエラーの変換、requestId をヘッダーに）

## Step 2: Accounts（backend/src/accounts）

データ: 表 `Accounts`（キー `accountId`、索引 `loginId`。項目 `loginId`・`displayName`・`role`・`organization`・`status`・`mustChangePassword`・`consentedAt`・`hunterNumber`・`createdAt`）— entities.md Account

- [x] Step 6 (Red): `session.u1.test.ts` — `POST /v1/session`（Cognito の InitiateAuth をモック。成功で証明・出し直し用の値・mustChangePassword・consentRequired・hunterNumberRequired を返す、失敗・無効で 401「ID かパスワードが違います」）、`POST /v1/session/refresh`（成功・30 日切れ・無効で 401）、`DELETE /v1/session`（RevokeToken を呼ぶ）— BR1.1・BR1.3・BR1.5（AC1.1.1・AC1.1.2・AC1.1.3・AC1.1.5）
- [x] Step 7 (Green → Refactor): `accounts/session.ts`・`accounts/repository.ts`
- [x] Step 8 (Red): `eligibility.u1.test.ts` — 内部の呼び出し C10: 同意と従事者番号があれば eligible と番号・表示名、なければ eligible=false、ハンター以外は拒否 — BR2.1
- [x] Step 9 (Green → Refactor): `accounts/eligibility.ts`（Lambda の直接の呼び出しの入口）

## Step 3: Reporting（backend/src/reporting）

データ: 表 `Photos`（キー `photoId`。`uploadedByAccountId`・`reportId`・`kind`・`storageKey`・`contentType`・`sizeBytes`・`uploadStatus`・`uploadedAt`）、表 `Reports`（キー `reportId`。`submissionKey`・`hunterAccountId`・`hunterNumber`・`capturedAt`・`capturedAtSource`・`location`・`locationSource`・`species`・`sex`・`submittedAt`・`eventSent`）、表 `SubmissionKeys`（キー `submissionKey`。`state`・`leaseExpiresAt`・`reportId`・`hunterAccountId`）— entities.md Photo・Report、reliability-design（送信のキーの状態、eventSent）

- [x] Step 10 (Red): `photos.u1.test.ts` — `POST /v1/photos`（形式・15 MB の確認、署名付きの POST の条件〈キー・内容の種類・content-length-range・5 分〉、`uploadUrl` と `uploadFields`）、`POST /v1/photos/{id}/complete`（持ち主、S3 の実物の存在・大きさ・形式、違えば消して 422・404）— BR2.2・BR2.9（AC2.1.1）
- [x] Step 11 (Green → Refactor): `reporting/photos.ts`
- [x] Step 12 (Red): `submit.u1.test.ts` — 送信のキーを最初に確かめる（保存済みなら 200 で同じ reportId、作成中で期限内なら 409、期限切れなら取り直す）、同意（C10 をモック）、写真の持ち主・結び付き、必須の項目、捕獲日時はサーバーの時刻、トランザクションで保存と写真の reportId、`report.saved` を 3 回まで送り、失敗なら 500、送り直しで再送 — BR2.1・BR2.3〜BR2.7（AC2.1.1・AC2.1.2・AC2.1.3）
- [x] Step 13 (Green → Refactor): `reporting/submit.ts`・`reporting/repository.ts`
- [x] Step 14 (Red): `get-report.u1.test.ts` — ハンターは自分の報告だけ、依頼元はすべて、写真の表示用 URL（15 分）— BR2.8・BR6.1（AC4.2.1・AC4.2.3・AC5.1.3）
- [x] Step 15 (Green → Refactor): `reporting/get-report.ts`

## Step 4: Review（backend/src/review）

データ: 表 `ReviewDecisions`（キー `reportId`。`hunterAccountId`・`status`・`decidedByAccountId`・`decidedByName`・`decidedAt`・`submittedAt`・`lastEventAt`・`eventSent`）、表 `ProcessedEvents`（キー `consumer#eventId`、TTL 7 日）— entities.md ReviewDecision、reliability-design

- [x] Step 16 (Red): `on-saved.u1.test.ts` — `report.saved` で確認中の記録（hunterAccountId を写す）、2 回目の eventId は無視 — BR3.1（AC4.3.1）
- [x] Step 17 (Green → Refactor): `review/on-saved.ts`
- [x] Step 18 (Red): `decision.u1.test.ts` — 依頼元だけ、記録がなければ 404 REVIEW_NOT_READY、確認中のときだけ承認（条件付き）、すでに確認済みなら 409 と確認した人、同じ依頼元の送り直しは 200 で eventSent が「まだ」なら再送、`review.status-changed` を送る。`GET /v1/reviews/{id}` はハンターは自分のものだけ — BR3.2〜BR3.7（AC4.3.1・AC4.3.2・AC4.3.3）
- [x] Step 19 (Green → Refactor): `review/decision.ts`・`review/get-review.ts`・`review/repository.ts`

## Step 5: ReportCatalog（backend/src/catalog）

データ: 表 `ReportListItems`（キー `reportId`。`hunterAccountId`・`hunterName`・`species`・`capturedAt`・`placeName`・`status`・`duplicateSuspected`・`manualEntry`・`submittedAt`・`savedReceived`・`lastSavedEventAt`・`lastStatusEventAt`。索引 ①全件 `gsiAll`〈固定のパーティション `ALL` ＋ `submittedAt#reportId`〉②ハンター `gsiHunter`〈`hunterAccountId` ＋ `submittedAt#reportId`〉）— entities.md ReportListItem、BR4.4、infrastructure-specification

- [x] Step 20 (Red): `on-events.u1.test.ts` — `report.saved` で行を作る、`review.status-changed` は新しいものだけ反映、状態が先に届いたら覚えて保存の知らせで一覧に出す、2 回目は無視 — BR4.1（AC2.1.1・AC4.3.2）
- [x] Step 21 (Green → Refactor): `catalog/on-saved.ts`・`catalog/on-status.ts`
- [x] Step 22 (Red): `list.u1.test.ts` — 依頼元はすべて新しい順・50 件・cursor・全件数・0 件、ハンターは自分だけ、壊れた cursor は 400、役割違いは 403 — BR4.2・BR4.3・BR4.4（AC4.1.1・AC4.1.3・AC4.1.4・AC5.1.1・AC5.1.2・AC5.1.4）
- [x] Step 23 (Green → Refactor): `catalog/list.ts`・`catalog/repository.ts`

## Step 6: 結合の試験（DynamoDB Local）

- [x] Step 24: `backend/test/integration/skeleton-flow.u1.test.ts` — DynamoDB Local（Docker なしで動く `dynamodb-local` の npm パッケージ）で、写真の受け付け → 送信 → `report.saved` を受け手に直接渡す → 一覧に出る → 承認 → 一覧が承認、の流れ。EventBridge と S3 と Cognito はモック — US2.1・US4.3・US5.1、NFR10.2〜NFR10.5

## Step 7: アカウントを作るスクリプト（scripts）

- [x] Step 25 (Red): `scripts/create-account.u1.test.ts` — ハンターは従事者番号が必須で同意の日時を入れる、依頼元は所属が必須、admin は拒否、Cognito の AdminCreateUser・グループ追加と Accounts の表の書き込み（モック）、仮のパスワードを 1 回だけ出力 — BR5.1
- [x] Step 26 (Green → Refactor): `scripts/create-account.ts`（`npm run account:create -- --role hunter ...`）

## Step 8: 画面（frontend）

- [x] Step 27: Vite ＋ React ＋ MUI の 2 つのアプリ（`frontend/hunter`・`frontend/requester`）と共通の部品 `frontend/ui-kit`、Vitest ＋ Testing Library の設定、実行時の設定 `config.json` を読む `loadConfig` — tech-stack、infrastructure-specification（WebContent）
- [x] Step 28 (Red): UiKit の部品の試験 `*.u1.test.tsx` — `LoginForm`（エラーで ID を残す）、`BigChoice`（radiogroup、選ぶまで次へ不可）、`PhotoPicker`（形式・15 MB、長辺 2,048 px の縮小を呼ぶ）、`LocationGate`（許可がないと送れない）、`SubmitButton`（送信中は押せない）、`ReportList`（50 件・次のページ・0 件・状態は文字とアイコン）、`DecisionBar`（409・404 の表示、確認済みは非表示）、2 つのテーマ（ハンター 20px・64px、職員 16px・48px）— frontend-components、NFR7.1・NFR8.1（AC1.1.3・AC2.1.2・AC2.1.3・AC4.1.4・AC4.3.3・AC5.1.4）
- [x] Step 29 (Green → Refactor): `ui-kit` の部品と `hunterTheme`・`staffTheme`（data-testid を付ける）
- [x] Step 30 (Red): 画面の流れの試験 — ハンター: ログイン → ホーム → 写真 → 種類と雌雄 → 送信 → 完了 → 一覧、送信の失敗で内容が残り同じ送信のキーで送り直す、トークンの出し直し（localStorage）とログアウト。依頼元: ログイン → 一覧 → 詳細 → 承認 — functional-spec UC1〜UC5（AC1.1.1・AC1.1.2・AC1.1.5・AC2.1.1・AC4.2.1・AC4.3.1）
- [x] Step 31 (Green → Refactor): `frontend/hunter`・`frontend/requester` の画面と API の呼び出し（`apiClient`：証明を付ける、10 秒で時間切れ、requestId を表示）

## Step 9: E2E（AWS なし）

- [x] Step 32: Playwright の設定（2 つのアプリを起動し、API はモックのサーバー）と `e2e/skeleton.u1.spec.ts`（`@u1`）— ハンターの報告から依頼元の承認まで、ハンターが依頼元の画面を開けない、ボタン 64px・文字 20px の寸法、axe の自動の検査で重大な違反なし — US1.1・US2.1・US4.1〜US4.3・US5.1、NFR7.1

## Step 10: AWS の構成（infra、CDK）

- [x] Step 33 (Red): `infra/test/*.u1.test.ts`（aws-cdk-lib/assertions）— Auth（自分での登録なし、パスワードの規則、トークンの期限、リフレッシュトークンの更新と 60 秒の猶予、グループ 3 つ）、Web（S3 の公開なし、OAC、HTTPS への転送、セキュリティのヘッダー）、Data（表 7 つ・キーと索引・RETAIN・TTL、写真の S3 の公開なし・SSE・CORS は POST と GET で 2 つの Origin）、Api（JWT オーソライザーが `/v1/session` と `/v1/session/refresh` 以外に付く、流量 10/20、関数のメモリ 128〜256 MB・Arm・Node.js 22・時間切れ 8/10 秒、ロググループ 14 日、関数ごとの IAM は自分の表だけ、Reporting だけが Accounts の関数を呼べる、EventBridge のルール、アラーム 2 つ〈5xx の計算式・treatMissingData〉と SNS）、WebContent（BucketDeployment と config.json）、全体（タグ Name がタグを付けられる全リソースにある、EC2・RDS・NAT・VPC などがない、スタックの依存が Auth → Web → Data → Api → WebContent）— infrastructure-specification、monitoring-design、NFR1.2・NFR4・NFR5・NFR12
- [x] Step 34 (Green → Refactor): `infra/bin/app.ts`・`infra/lib/{auth,web,data,api,web-content}-stack.ts`・`infra/lib/tagging-aspect.ts`（qualifier `mnote` の synthesizer、アラームの宛先は `-c alarmEmail`）

## Step 11: スモークと CI

- [x] Step 35: `scripts/smoke.ts`（`npm run smoke`。`infra/.env.local` から URL と試験用のアカウントを読み、cicd-pipeline の 7 手順を実行）と `infra/.env.local.example`（値なしの見本）— cicd-pipeline 段階 6
- [x] Step 36: `.github/workflows/ci.yml`（push と PR: `npm ci` → format:check → lint → typecheck → vitest（カバレッジ）→ Playwright（AWS なし）→ `cdk synth`。AWS の認証情報は使わない）— NFR13.3、cicd-pipeline 段階 2

## Step 12: 仕上げ

- [x] Step 37: 約束の仕様のファイル（`contracts/openapi.yaml`・`contracts/asyncapi.yaml`）に U1 の道と知らせを書く。C2 の `uploadFields` と source の `device` を足す — contract-summary 6、infrastructure-specification 5
- [ ] Step 38: `npm run verify` を通す（format・lint・typecheck・テスト・E2E・cdk synth）

## ストーリーとの対応

| ストーリー | 計画のステップ |
|---|---|
| US1.1 ログイン | Step 2〜7、28〜32、33〜34 |
| US2.1 写真 1 枚で報告 | Step 10〜13、24、28〜32 |
| US4.1 一覧（絞り込み以外） | Step 20〜23、28〜32 |
| US4.2 詳細（見比べ以外） | Step 14〜15、28〜32 |
| US4.3 承認 | Step 16〜19、24、28〜32 |
| US5.1 自分の一覧 | Step 20〜24、28〜32 |

## デプロイについて

このステージではデプロイしない（Code Generation は AWS に適用しない）。CDK の bootstrap と最初のデプロイは、コードができたあと、cicd-pipeline の段階 0・4・5 のとおり、`cdk diff` と費用の見込みを示して人の承認を得てから行う。

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
