# Code Generation Plan — U4 `u4-accounts-admin`

入力: functional-design（functional-spec.md・rules.md・entities.md・frontend-components.md）、nfr-design（performance・reliability・security・scalability・observability-design.md・logical-components.md）、infrastructure-design/infrastructure-specification.md、`inception/contract-design/contract-summary.md`、U1〜U3 の実装（`backend/src/`・`frontend/`・`infra/`）。

**運用上の注記**: このUnitは、swarmのバッチチェックポイントに関する既知のツールの不具合（docs/05-construction.md §18）のため、AI-DLCの自動進行（`next`/swarm）を使わず、会話内で直接・単独（serial）に進める。TDD・アーキテクチャレビュー・学習記録など、品質の手順はこれまでのUnitと同じ厳密さを保つ。

テスト件数の見込み: 約110件（単体70、結合20、E2E10、CDK構成試験10）。Standard戦略＋featureスコープの行カバレッジ80%以上。

## 0. Code Generation前に確認した前提の誤り（重要）

設計書（rules.md BR12.5、observability-design.md NFR14.5）は「U1〜U3の部品はすでに`audit.recorded`を送る形になっている」としているが、**実際のコード（`backend/src/reporting/`・`backend/src/review/`・`backend/src/duplicate-detection/`）にはaudit.recordedの送信が1つも存在しない**（`grep -rln "audit.recorded" backend/src/`で確認済み、0件）。observability-design.mdのAssumptions自身も「Code Generationの時点で確かめる。送っていなければ足す」と明記しており、これは想定内の確認作業として扱う。

したがって、U4のCode Generationでは、AuditLog関数（受け手）を作るだけでなく、**以下の既存コードにaudit.recordedの送信を追加する**:
- `backend/src/reporting/submit.ts`（report.submitted）
- `backend/src/review/decision.ts`（review.approved・review.rejected）
- `backend/src/review/undo.ts`（review.undone）
- `backend/src/duplicate-detection/*.ts`（重複の疑いを検出した箇所。duplicate.suspected）

これを追加しないと、UC27・AC6.6.1（「依頼元の承認なら『承認・依頼元の名前・日時・報告』」）が満たせない。

## 0b. Code Generation後に自己発見・修正した欠陥（重要。d60e400a）

Step 13（インフラ）完了後、`npm run verify`の前に自分の実装を見直し、2件の欠陥を見つけて直した（人に報告のうえ修正を承認済み）:

1. **管理者専用の11個のAPIすべてに`role=admin`のサーバー側確認が無かった**（重大なセキュリティ上の欠陥）。`createCreateAccountRoute`・`createPasswordResetRoute`・`createSetStatusRoute`・`createListAccountsRoute`・`createGetSettingsRoute`・`createUpdateSettingsRoute`・`createListEntriesRoute`・5つの`createDeleteAllRoute`系すべてで`requireRole(caller, 'admin')`を呼んでいなかった。ハンター・依頼元としてログインした利用者でも、これらの管理者専用の道を直接呼べる状態だった。各ファイルの該当箇所に`requireRole(caller, 'admin')`を追加し、各ルートに403のテストを足した。
2. **BR12.5が求めるアカウントの作成・再設定・無効化の操作の記録が一切残っていなかった**。`accounts`関数にEventBridgeへ送信する経路（環境変数`EVENT_BUS_NAME`・IAM権限）自体が無かったため。`create-account.ts`（action: account.created）・`password-reset.ts`（account.password-reset）・`set-status.ts`（account.disabled／account.enabled）に`publishAuditRecorded`の呼び出しを追加し、`infra/lib/api-stack.ts`にaccounts関数へのEventBridge配線を足した。

どちらも`npm run verify`実行前に修正済み（バックエンド402件・フロントエンド等含め計611件のテスト、E2E 30件、CDK synthですべて確認）。

## 0c. アーキテクチャレビュー（iteration 1）が見つけた欠陥

独立した敵対的レビュー（`aidlc-architecture-reviewer-agent`、iteration 1）が、§0bで直した3件と同じ種類の欠陥をもう1件見つけた（NOT-READY、Major 2件・Minor 1件）:

1. **（Major）`backend/src/handlers/audit-log.ts`に`passwordGate`が無かった** — §0bで6つのハンドラ（accounts・catalog・reporting・settings・review・duplicate-detection）に`passwordGate`を配線したが、U4で新設したもう1つの管理者専用ハンドラ`audit-log.ts`にだけ配線し忘れていた。`GET /v1/admin/audit-entries`は仮のパスワードのままの管理者でも呼べる状態だった。`createRemotePasswordGate`を他の5つと同じ形で配線し、`infra/lib/api-stack.ts`にAccountsへのEventBridge Invoke権限と`ACCOUNTS_FUNCTION_NAME`環境変数を追加し、403になることのテストを足した。
2. **（Major）`unit-test-instructions.md`自身の「このUnitだけを動かすコマンド」が壊れていた** — 1本目のコマンドは`backend/src/shared/`の新規テスト3本（`batch-delete`・`events`・`password-gate-client`）と、存在しない`accounts.u4.test.ts`・`audit-log.u4.test.ts`（実際は`handlers.u4.test.ts`にまとまっている）を指しており、2本目のコマンドは存在しない`backend/src/handlers/settings.u4.test.ts`を指していた（Vitestはこれをエラーなく黙って無視する）。両方のコマンドを実在するパス・globに直した。
3. **（Minor）`code-summary.md`の「行カバレッジ86.17%」が実際にはStmts列の値で、Lines列（88.35%）と食い違っていた** — ラベルをLines列の値に合わせて修正した。

いずれも人には確認せず、レビューの指摘どおりにその場で修正し、2回目のレビューを受けた（下記）。

- [x] Step 1: `backend/src/accounts/repository.ts`を拡張し、`Account`に`consentDeclinedAt`・`createdByAccountId`・`lastActiveAt`を追加（entities.md）。`AdminCounter`用の新しいリポジトリ`backend/src/accounts/admin-counter.ts`（新規）を作る: `incrementOnCreate`・`decrementOnDisable`（条件`activeAdminCount >= :two`）・`incrementOnEnable`・`reconcile`（一覧読み出し時の数え直し）。`backend/src/audit-log/repository.ts`（新規）: `AuditEntry`の`putIfAbsent`（`ConditionExpression: attribute_not_exists(eventId)`）・`listPage`（occurredAtの新しい順・50件）。対応するテスト: `admin-counter.u4.test.ts`・`audit-log/repository.u4.test.ts`・`accounts/repository.u4.test.ts`（拡張分）。DynamoDB Localでの結合試験も含める。

## 2. 共有ミドルウェア（mustChangePassword。security-design.md §1）

- [x] Step 2: `backend/src/shared/require-password-changed.ts`（新規）。JWTのclaimsとAccountの`mustChangePassword`を見て、`PUT /v1/me/password`・`GET /v1/me`以外のすべてのルートを`403 PASSWORD_CHANGE_REQUIRED`で拒む共通関数を作る。既存の各ハンドラ（`accounts.ts`・`reporting.ts`・`review.ts`・`catalog.ts`・`duplicate-detection.ts`・`settings.ts`）のルーティングの入口（`handlers/*.ts`のリクエストディスパッチ部分）1箇所ずつにこのチェックを差し込む（個別のビジネスロジックには書かない）。テスト: `require-password-changed.u4.test.ts`（単体）、既存ハンドラの統合テストに「mustChangePassword=trueのときは403」のケースを1件ずつ追加。

## 3. アカウントの初回手続き（UC21。BR11.4〜BR11.7）

- [x] Step 3: `backend/src/accounts/`に`change-password.ts`（`PUT /v1/me/password`。8文字以上・英字数字の確認、Cognitoの`AdminSetUserPassword`→`mustChangePassword=false`の更新）、`consent.ts`（`PUT /v1/me/consent`。同意する/しないでconsentedAt/consentDeclinedAtを更新）、`hunter-number.ts`（`PUT /v1/me/hunter-number`。数字1〜20桁の確認）、`get-me.ts`（`GET /v1/me`。3つの印を返す）を追加。`POST /v1/session`の応答（既存の`accounts/session.ts`）に`mustChangePassword`・`consentRequired`・`hunterNumberRequired`の3つの印を追加（BR11.7・C1）。テスト: 各ファイルに対応する`.u4.test.ts`、境界値（7文字のパスワード、空の従事者番号など）を含む。

## 4. 管理者のアカウント管理（UC22〜UC24。BR11.1〜BR11.3・BR11.9〜BR11.11）

- [x] Step 4: `backend/src/accounts/`に`create-account.ts`（`POST /v1/admin/accounts`。項目確認→Cognito `AdminCreateUser`/`AdminSetUserPassword`（Q3-A: 先にCognito、成功後にDynamoDBのTransactWriteItems）→`Account`作成＋`AdminCounter`+1〈role=adminのときだけ〉）、`password-reset.ts`（`POST /v1/admin/accounts/{id}/password-reset`）、`set-status.ts`（`PUT /v1/admin/accounts/{id}/status`。自分自身チェック→無効化はTransactWriteItems〈status=disabled AND AdminCounter-1、条件activeAdminCount>=2〉、有効化はstatus=active AND AdminCounter+1）、`list-accounts.ts`（`GET /v1/admin/accounts`。読み出し時にAdminCounterの数え直しも行う。reliability-design.md §1）を追加。reliability-design.mdの指示どおり、**DynamoDB側にloginIdの一意性確認の仕組み（条件付き書き込み・ロック項目）を実装しない**（Cognitoの`UsernameExistsException`に委ねる。重複時は`409 LOGIN_ID_TAKEN`）。テスト: 各ファイルの`.u4.test.ts`、同時に2人を無効化する同時操作のテスト（NFR13.11）、最後の管理者・自分自身のケース。

## 5. 操作の記録（UC27・UC28。BR12.1〜BR12.5）

- [x] Step 5: §0で特定した4箇所（reporting/submit.ts・review/decision.ts・review/undo.ts・duplicate-detection配下）に`publishEvent('audit.recorded', ...)`の送信を追加する。`shared/events.ts`に`AuditRecordedData`型（action・targetType・targetId・actorAccountId・actorName・outcome・detail）を追加。`backend/src/audit-log/`に`on-recorded.ts`（知らせの受け手。eventId条件付きPutItem）・`list-entries.ts`（`GET /v1/admin/audit-entries`）を追加。`backend/src/accounts/`・`backend/src/handlers/settings.ts`の作成・無効化・有効化・パスワード再設定・設定変更の各処理からも`audit.recorded`を送る（account.created・account.disabled・account.enabled・account.password-reset・settings.updated）。テスト: `on-recorded.u4.test.ts`（同じeventIdを2回受けても1件）、`list-entries.u4.test.ts`、既存の4箇所の拡張テストに「audit.recordedを送ること」のアサーションを追加。

## 6. 設定の変更（UC25。BR9.2・BR9.4）

- [x] Step 6: 既存の`backend/src/handlers/settings.ts`・`backend/src/settings/`（U2で作成済み、読み出し専用）に`update-settings.ts`（`PUT /v1/admin/settings`）を追加。範囲確認（距離1m以上、北>南・東>西）、`updatedByAccountId`・`updatedAt`の記録、`audit.recorded`（settings.updated）の送信。テスト: `update-settings.u4.test.ts`（範囲外の値のケースを含む）。

## 7. 試験運用の終わりの削除（UC26。BR13.1〜BR13.4）

- [x] Step 7: 4つの既存関数に削除の入口を追加する（U1の実際の構成どおり、review・catalogは別関数。infrastructure-specification.md）:
  - `backend/src/catalog/delete-all.ts`（新規。`POST /v1/admin/catalog-data`。`ReportListItems`をBatchWriteItemでループ削除）
  - `backend/src/review/delete-all.ts`（新規。`POST /v1/admin/review-data`。`ReviewDecisions`）
  - `backend/src/duplicate-detection/delete-all.ts`（新規。`POST /v1/admin/duplicate-data`。`ReportFootprints`・`DuplicateSuspicions`の両方）
  - `backend/src/reporting/delete-all.ts`（新規。`POST /v1/admin/detection-data`で`DetectionResults`、`POST /v1/admin/reporting-data`で`Report`・`Photo`〈DynamoDB削除＋S3の`DeleteObjects`〉。1つの関数が2つの論理的な削除対象を順に処理する）
  いずれも「対象がすでに0件なら0件で成功」（冪等）。各入口は完了後に`audit.recorded`（data.deleted、detailに件数）を送る。テスト: 各`delete-all.u4.test.ts`（0件のケース・25件超のバッチ境界のケースを含む）、DynamoDB Localでの結合試験。

## 8. API層（ハンドラーの配線）

- [x] Step 8: `backend/src/handlers/accounts.ts`に新しいルート（`PUT /v1/me/password`・`PUT /v1/me/consent`・`PUT /v1/me/hunter-number`・`GET /v1/me`・`GET /v1/admin/accounts`・`POST /v1/admin/accounts`・`PUT /v1/admin/accounts/{id}/status`・`POST /v1/admin/accounts/{id}/password-reset`）を配線。`backend/src/handlers/catalog.ts`・`review.ts`・`duplicate-detection.ts`・`reporting.ts`に削除の入口のルートを配線。`backend/src/handlers/settings.ts`に`PUT /v1/admin/settings`を配線。`backend/src/handlers/audit-log.ts`（新規）に`GET /v1/admin/audit-entries`とEventBridgeの受け手（`onRecordedHandler`）を配線。すべて`role=admin`のJWT確認（既存の`shared/auth.ts`相当の仕組みを再利用）とStep 2のmustChangePasswordミドルウェアを通す。テスト: `handlers.u4.test.ts`（ルーティングの確認、403/404の境界）。

## 9. フロントエンド（Red → Green → Refactor）

- [x] Step 9 (Red): 新しい部品・画面のテストを先に書く: `frontend/ui-kit/src/components/`の`PasswordChangeForm`・`ConsentPanel`・`HunterNumberForm`・`AccountTable`・`AccountForm`・`TempPasswordPanel`・`SettingsForm`（書き込み対応に拡張）・`AuditTable`・`DeleteConfirm`・`DeleteProgress`の`.u4.test.tsx`。`frontend/ui-kit/src/session/roles.ts`・`SessionContext.tsx`の`requiredRole`を`Role | Role[]`に拡張するテスト（管理者が依頼元の画面にも入れるようにするため。後述）。
- [x] Step 10 (Green): 上記の部品を実装する。`frontend/ui-kit/src/session/SessionContext.tsx`の`requiredRole`を配列も受け付けるよう拡張（`AppFrame`の`role`プロップは`role="requester"`から`role={['requester', 'admin']}`に変更。U1の2画面構成のまま、**新しいS3・CloudFrontは作らない**、インフラのQ1に基づき管理者の画面はRequesterAppの中にメニューとして追加する）。`frontend/requester/src/pages/admin/`配下に`AccountsPage`・`AccountDetailPage`・`SettingsPage`・`AuditLogPage`・`DeleteAllPage`を追加し、`frontend/requester/src/App.tsx`にroute（`/admin/accounts`・`/admin/accounts/:accountId`・`/admin/settings`・`/admin/audit`・`/admin/delete`）を追加。`AppShell`（`frontend/ui-kit/src/AppShell.tsx`相当）に管理者のときだけメニュー項目を出す分岐を追加。`frontend/hunter/src/`・`frontend/requester/src/`の両方のログイン後の流れに、初回手続き（パスワード変更→同意〈ハンターのみ〉→従事者番号〈ハンターのみ〉）の画面遷移を追加。`frontend/requester/src/api.ts`・`frontend/hunter/src/api.ts`に対応するAPI呼び出し関数を追加。
- [x] Step 11 (Refactor): 共通化できる部分（初回手続きの画面遷移ロジックがhunter/requester両方にあるため、`ui-kit`に共通フックとして抽出できないか検討）を整理する。テストが通ったまま行う。

## 10. スクリプトの更新（BR11.11・US6.1）

- [x] Step 12: `scripts/create-account.ts`の`validateInput`から「U1ではadminのアカウントは作れません」という拒否（現在72〜73行目）を削除し、`role === 'admin'`を他の役割と同様に受け付ける。`createAccount`関数に、`role==='admin'`のときの`AdminCounter`の`if_not_exists`による+1（reliability-design.md §1の最初の管理者のロジック）を追加する。**スクリプトの既存の`mustChangePassword: false`の挙動は変えない**（スクリプトはU1からの開発者手元の手順であり、BR11.3のtriggerは管理者の画面のAPIだけを指すため）。テスト: `create-account.u4.test.ts`（`--role admin`のケース、AdminCounterの増加を確認）。

## 11. インフラ（CDK）

- [x] Step 13: `infra/lib/data-stack.ts`に`AdminCounter`（キーcounterKey）・`AuditEntries`（キーentryId、発生日時の索引、`RemovalPolicy.RETAIN`、TTLなし）の2つの新しい表を追加。`infra/lib/api-stack.ts`: `catalog`・`review`・`duplicate-detection`・`reporting`の4関数のtimeoutを15秒に統一（infrastructure-specification.md §1）。各関数に削除対象の表への`BatchWriteItem`権限を追加。`accounts`関数のIAMに`cognito-idp:AdminCreateUser`・`AdminSetUserPassword`・`AdminAddUserToGroup`権限と`AdminCounter`への読み書きを追加（`AdminUpdateUserAttributes`・`AdminDisableUser`などは**追加しない**。最小権限。U1のBR11.8の無効化はDynamoDB側だけで行うため）。`audit-log`関数（新規。128MB・10秒）を追加し、`AuditEntries`への読み書き権限、EventBridgeから`audit.recorded`を受けるルールを追加。新しいAPI Gatewayルート（§8の一覧）をすべて追加。テスト: `infra/test/stacks.u4.test.ts`（新規。4関数のtimeout=15秒、audit-log関数のメモリ/timeout、Cognito権限がaccounts関数だけに付いていること、AdminCounter/AuditEntriesの表の確認）。`stacks.u1.test.ts`の関数総数・ルート総数のアサーションを更新（11関数→12関数〈audit-log追加〉、ルート数の更新）。

## 12. 契約文書・スクリプト

- [x] Step 14: `contracts/openapi.yaml`にD-1〜D-7（functional-spec.md §7）を反映: 新しいルートをすべて追加、既存ルートへの403 PASSWORD_CHANGE_REQUIRED・422 LAST_ADMIN/CANNOT_DISABLE_SELFの追加。`contracts/asyncapi.yaml`に`audit.recorded`の知らせを追加。

## 13. ドキュメント・traceability

- [x] Step 15: `code-summary.md`・`traceability.json`・`source-manifest.json`を作成する。§0で見つけた「audit.recordedが実際には送られていなかった」という前提の誤りと、その対応を正直に記録する。

## テストの見込み（内訳）

| 種類 | 件数の見込み |
|---|---|
| 単体（accounts・audit-log・settings拡張・削除の入口・共有ミドルウェア） | 約70件 |
| 結合試験（DynamoDB Local。同時操作・AdminCounterの整合性を含む） | 約20件 |
| フロントエンド（部品・画面） | 約25件 |
| CDKの構成試験（stacks.u4.test.ts） | 約10件 |
| E2E（Playwright。初回手続き・アカウント作成・無効化・操作の記録・すべて削除） | 約10件（5シナリオ×2ブラウザ） |
| **合計** | **約135件** |
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
