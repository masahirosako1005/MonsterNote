# Load Test Plan — Performance Validation

## 1. これは「負荷試験」ではない

project.mdのForbidden「NEVER run load tests that could exceed the Free Tier」、team.mdの「無料枠を超えるおそれのある負荷試験はしない。数十リクエスト程度の確認にとどめる」に従い、本計画は**負荷試験・スケール試験・持続的な負荷ではない**。目的は、Build and TestのTarget Verification Matrixが`Unverified`としていたNFR2.x（p95応答時間）について、実際に`dev`へデプロイされた本物のAPIに対して、実際の利用規模（月50件未満の報告、同時利用者10人以下）に見合う**軽い・一度きりの**実測を行い、「おおよそ目標の範囲に収まっているか」の健全性確認をすることである。

- 並行度: 常に1（直列実行。`scripts/smoke.ts`と同じ方針）。同時に複数リクエストを飛ばす負荷の掛け方はしない。
- 持続時間: 数分以内で終わる1回きりの実行。繰り返し・ランプアップはしない。
- 総リクエスト数: 下表のとおり約45〜50件（API Gateway/Lambdaの無料枠は月100万リクエスト規模のため、全く問題にならない）。

## 2. 計測する項目と想定件数

| # | 呼び出し | 対応するNFR | 件数 | 備考 |
|---|---|---|---|---|
| 1 | `POST /v1/session`（ハンター・依頼元・管理者） | — | 3 | ログイン。各ロールのトークンを取得 |
| 2 | `POST /v1/photos` + `POST /v1/photos/{id}/complete`（全身・尻尾） | NFR2.6・NFR2.7 | 12 | 報告3件分（1件につき写真2枚×2呼び出し） |
| 3 | `POST /v1/reports` | NFR2.2 | 3 | 上記3件分の報告を送信 |
| 4 | ハンターの一覧（`GET /v1/catalog/my-reports`）の再読み出しで「確認中」になるまで待つ | NFR2.10（間接） | 約9 | `scripts/smoke.ts`と同じポーリング方式。report.savedの受け手（重複判定）の処理時間の目安になる |
| 5 | `GET /v1/catalog/reports`（絞り込みあり・なし） | NFR2.1・NFR2.12 | 5 | 依頼元の一覧 |
| 6 | `GET /v1/reviews/{id}` | NFR2.1 | 3 | 詳細 |
| 7 | `PUT /v1/reviews/{id}/decision`（approved） | NFR2.3 | 2 | 2件を承認 |
| 8 | `PUT /v1/reviews/{id}/decision`（rejected） | NFR2.13 | 1 | 残り1件を却下 |
| 9 | `POST /v1/reviews/{id}/decision/undo` | NFR2.14 | 1 | 却下した1件を取り消す |
| 10 | `GET /v1/admin/accounts` | NFR2.15 | 3 | 管理者の一覧 |
| 11 | `POST /v1/admin/accounts`（使い捨てアカウント作成） | NFR2.16 | 1 | `perfcheck-<乱数>`という名前。試験後は無効化する（下記） |
| 12 | `POST /v1/admin/accounts/{id}/password-reset` | NFR2.16 | 1 | 上記アカウントに対して |
| 13 | `PUT /v1/admin/accounts/{id}/status`（disable。後片付け） | — | 1 | 使い捨てアカウントを無効化。「すべて削除」（破壊的操作・NFR2.18）は使わない |
| 14 | `GET /v1/admin/audit-entries` | NFR2.17 | 3 | 操作記録の一覧 |

**合計: 約48リクエスト。**

## 3. 計測しない項目（`nfr-validation-matrix.md` §4で詳述）

- NFR2.12の上限（2,000件）近くでの実測（データを人為的に増やしてまで検証しない）
- NFR2.18「すべて削除」（破壊的操作。試験データが失われる）
- NFR2.4・NFR2.11（画面での体感速度。API直叩きでは測れない）
- NFR2.5（コールドスタート。意図的な再現はしない。自然発生時の値をダッシュボードで継続観察する）

## 3b. 前提: 管理者の試験用アカウントがまだ無い

`infra/.env.local`には`SMOKE_HUNTER_*`・`SMOKE_REQUESTER_*`はあるが、管理者（role=admin）の試験用アカウントは無い（U4のE2Eはモック環境だけで確認しており、実機`dev`に管理者アカウントを作ったことがまだ無い）。`POST /v1/admin/accounts`はすでに管理者であることが前提のAPIのため、API経由では作れない（鶏と卵）。実行前に、人が`npm run account:create -- --role admin --login-id <...> --display-name <...>`（CognitoのSDKを直接呼ぶ、APIを経由しない唯一の作成手段）で最初の管理者アカウントを1つ作り、`infra/.env.local`に`SMOKE_ADMIN_LOGIN_ID`・`SMOKE_ADMIN_PASSWORD`として追加する必要がある。

## 4. 計測の方法・道具

`scripts/perf-check.ts`を`scripts/smoke.ts`と同じ方式（`infra/.env.local`から実際のURL・試験用アカウントを読む）で用意し、人の承認を得て実行した（記録: ae63bcdb）。各呼び出しの応答時間を記録し、p50・p95・最大値を算出して出力する。

**実行して分かったこと**: 1回目の実行は`POST /v1/reports`が`409 DUPLICATE_SUSPECTED`で失敗した。スクリプト自身が毎回同じ緯度経度・種類で送信しており、当日すでに`npm run smoke`で送信済みの報告と重複の疑いに引っかかったため（スクリプトのバグ）。緯度経度に小さな乱数のずれを加えて修正し、再実行してすべて成功した。結果は`test-results.md`参照。

実行は人の承認を得てから行う（project.mdのMandated「ALWAYS ask the human before running any deploy or destroy against AWS」は厳密にはデプロイ・削除の規定だが、実機への実際のトラフィックを発生させる点は同じ配慮が要ると判断し、同様に人に確認してから実行する）。

## 5. 観測の道具（既存のものを再利用）

- `operation/observability-setup/dashboards.md`のCloudWatchダッシュボード（`masahiro-cloudwatch-monsternote-operations`）で、計測中のAPI・Lambdaの状況をあわせて確認する。
- `operation/observability-setup/log-queries.md`の`requestId`追跡クエリで、計測スクリプトが受け取った問い合わせ番号から個別のリクエストのログを追える。

## Assumptions & Open Questions

None（Q1・Q2とも`performance-validation-questions.md`で回答・実行済み）。
