# SLO Config — Observability Setup

入力: `construction/u1-skeleton/infrastructure-design/monitoring-design.md`・`construction/u2-report-duplicate/infrastructure-design/monitoring-design.md`・`construction/u3-review-list/infrastructure-design/monitoring-design.md`・`construction/u4-accounts-admin/infrastructure-design/monitoring-design.md`（Unit ごとの SLI/SLO 表）、`construction/u1-skeleton/nfr-design/reliability-design.md`（NFR10.1: 99%／30 日）、`construction/u2-report-duplicate/nfr-design/performance-design.md`・`construction/u3-review-list/nfr-design/performance-design.md`・`construction/u4-accounts-admin/nfr-design/performance-design.md`（時間の予算）、`construction/u1-skeleton/infrastructure-design/infrastructure-specification.md`（関数とルートの対応）。

## 1. SLI/SLO 一覧（全 Unit を統合）

全体の目安（NFR10.1、U1 reliability-design）: **API の成功の割合（5xx でない呼び出し ÷ 全体）99% 以上、30 日のローリングウィンドウ**。

| SLI | 対応する API | SLO target | 計測窓 | 決めた Unit |
|---|---|---|---|---|
| 一覧・詳細・承認の Latency p95 | `GET /v1/reviews/{id}`, `GET /v1/catalog/*`, `PUT /v1/reviews/{id}/decision`（承認） | 3 秒以内 | 30 日 | U1 |
| 送信の Latency p95 | `POST /v1/reports` | 10 秒以内 | 30 日 | U1 |
| 写真の受け付け Latency p95 | `POST /v1/photos` | 3 秒以内 | 30 日 | U2 |
| アップロードの完了 Latency p95（判別を含む） | `POST /v1/photos/{id}/complete` | 6 秒以内 | 30 日 | U2 |
| 却下の Latency p95 | `PUT /v1/reviews/{id}/decision`（却下） | 3 秒以内 | 30 日 | U3 |
| 取り消しの Latency p95 | `POST /v1/reviews/{id}/decision/undo` | 2 秒以内 | 30 日 | U3 |
| 絞り込み一覧の Latency p95 | `GET /v1/catalog/reports` | 3 秒以内 | 30 日 | U3 |
| アカウント一覧・操作記録一覧の Latency p95 | `GET /v1/admin/accounts`, `GET /v1/admin/audit-entries` | 3 秒以内 | 30 日 | U4 |
| アカウント作成・パスワード再設定の Latency p95 | `POST /v1/admin/accounts`, `POST /v1/admin/accounts/{id}/password-reset` | 3 秒以内 | 30 日 | U4 |
| 「すべて削除」各入口の Latency p95 | `POST /v1/admin/{catalog,review,duplicate,detection,reporting}-data` | 10 秒以内 | 30 日 | U4 |

## 2. 時間切れ（timeout）と SLO を混同しないこと — 本ステージで確定させる区別

U4 で `reporting`・`review`・`catalog`・`duplicate-detection` の 4 関数の Lambda タイムアウトが 15 秒に揃えられた（`infra/lib/api-stack.ts`、「すべて削除」のバッチ処理に安全余裕を持たせるため）。これは **AWS 側の強制終了までの時間**であり、上の表の SLO target（3 秒・10 秒など、画面側の利用者体験の目安）とは別物である。

- `reporting` 関数は、送信（NFR2.2・U2 で 9 秒に変更）・写真の受け付け（3 秒）・完了（6 秒）という複数のルートを持つが、どのルートの SLO target も 15 秒の timeout より十分短い。timeout の引き上げは、どのルートの実測 p95 にも影響しない（U4 performance-design §3 の確認のとおり）。
- 同様に `review`（却下 3 秒／取り消し 2 秒）、`catalog`（絞り込み 3 秒）、`duplicate-detection`（重複判定 10 秒）も、15 秒の timeout 内に収まる前提で SLO target は変わっていない。
- 15 秒という値そのものが監視対象になるのは、「Lambda `Duration` の最大が timeout の 80% に近づいていないか」という別の KPI（§4）としてであり、SLO の目標値を書き換えたものではない。

この区別が設計文書の中で曖昧になりやすい（timeout の変更記録と SLO target の記録が別々の Unit の performance-design に分散しているため）ので、本ステージの成果物としてここに統合して明示する。

## 3. どうやって「30 日のローリング」を実際に測るか — 計測方法の具体化（本ステージの追加分）

Unit 側の NFR/Infrastructure Design は SLO の目標値だけを決めており、**どう計算するか**までは決めていない（`monitoring-design.md` は「30 日のローリング」と書くのみ）。このプロジェクトは X-Ray も CloudWatch Application Signals も使わない方針（`tracing-config.md`）のため、SLO の実測は CloudWatch の標準メトリクスと Logs Insights の組み合わせで行う。

### 3.1 API 全体の成功率（API Gateway の集約値）

`masahiro-cloudwatch-monsternote-api-5xx` アラームと同じ 2 つの指標（`AWS/ApiGateway` の `5xx`・`Count`、`ApiId` で絞る）を使い、CloudWatch コンソールの「メトリクス」画面でピリオドを 30 日に広げた単一データポイントのグラフ式 `100 - (SUM(5xx) / SUM(Count) * 100)` を見る。アラームの判定ロジック（metric math）とは別に、SLO 確認用にこの式を手元で都度確認する（ダッシュボードは作らない方針。`dashboards.md` 参照）。

### 3.2 ルートごとの p95 Latency（API Gateway の集約指標では出せない）

**重要な制約**: HTTP API（API Gateway v2）の既定のメトリクス（`Latency`）は API 全体の集約値であり、ルート（`routeKey`）ごとには分解されない（詳細メトリクスを有効にすると追加費用が発生するため、project.md の無料枠方針によりここでは使わない）。複数のルートを 1 つの関数が受け持つ構成（例: `reporting` が送信・写真受け付け・完了・対象地域の 5 ルートを担当）のため、Lambda 側の `Duration` 指標もルート単位には分解できない。

したがって、ルートごとの p95 を知る唯一の手段は、HTTP API のアクセスログ（`routeKey`・`latency` を含む。`infra/lib/api-stack.ts` の `accessLogSettings`）を CloudWatch Logs Insights で集計すること。`log-queries.md` §5 に保存するクエリ（`stats pct(latency, 95) by routeKey`）がこの SLO 測定の実体になる。30 日分を見るときは Logs Insights のクエリの期間指定を 30 日に広げて実行する（自動では走らない。必要なときに人が実行する運用。Q5/Q3-A の「ダッシュボード・常時監視は作らない」という一貫した方針と合わせる）。

### 3.3 まとめ

| SLI の種類 | 測定の実体 | 自動化の有無 |
|---|---|---|
| API 全体の成功率 | `AWS/ApiGateway` の `5xx`/`Count`（既存アラームと同じ指標） | アラームとして常時監視（`alarms.md`） |
| ルートごとの p95 Latency | アクセスログの Logs Insights クエリ（`log-queries.md` §5） | 自動化なし。必要なときに人が実行 |
| 関数固有の失敗（判別上限超過・重複上限到達 等） | 構造化ログの Logs Insights クエリ（`log-queries.md` §2〜4） | 自動化なし |

## Assumptions & Open Questions

- ルートごとの p95 を定期的（例: 週次）に自動集計して記録する仕組み（CloudWatch Logs Insights の `QueryDefinition` を超えて、結果を定期保存する仕組み）は、試験運用の規模・people 体制（開発者 1 人）では過剰と判断し、本ステージでは作らない。規模が広がった場合に Performance Validation や Feedback & Optimization で再検討する。 [assumption]
- U2 で `reporting` の timeout を 8→9 秒、U4 で 9→15 秒に 2 段階で引き上げた経緯が複数の Unit の performance-design に分散しているため、今後 timeout を再度見直す際はこの `slo-config.md` §2 の整理を一次情報として使い、各 Unit の performance-design を逐一つなぎ直さなくてよいようにする。 [assumption]
