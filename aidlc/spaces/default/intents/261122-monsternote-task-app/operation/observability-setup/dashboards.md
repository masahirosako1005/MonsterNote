# Dashboards — Observability Setup

入力: `construction/u1-skeleton/infrastructure-design/monitoring-design.md`（「ダッシュボードは作らない」という U1 の決定、Q5）、`construction/u2-report-duplicate/infrastructure-design/monitoring-design.md`・`construction/u3-review-list/infrastructure-design/monitoring-design.md`・`construction/u4-accounts-admin/infrastructure-design/monitoring-design.md`（U2〜U4 がこの方針を継続）、`operation/deployment-execution/health-check-report.md`（現在デプロイ済みの実際の構成）、`infra/lib/api-stack.ts`・`infra/lib/data-stack.ts`（対象のリソース）。

## 1. 現在の方針: 専用のダッシュボードは作らない（U1〜U4 の一貫した決定を継続）

U1 の monitoring-design（Q5）以降、U2・U3・U4 のどの Unit でも「ダッシュボードは作らない。標準のメトリクス画面と Logs Insights のクエリで見る」という判断が繰り返されている。理由は、CloudWatch のダッシュボードは 3 つまで無料だが、試験運用の規模（開発者 1 人＋少人数の試験利用者）では標準のメトリクス画面で十分、というもの。本ステージはこの判断を覆さない。

デプロイ後の実機（`health-check-report.md`）でも、ダッシュボード用の CloudFormation リソース（`AWS::CloudWatch::Dashboard`）は `infra/lib/` のどこにも定義されておらず、設計と実装は一致している。

## 2. 代わりに見るべき標準の画面（運用者向けの手引き）

ダッシュボードを作らない代わりに、次の標準画面を使って状況を把握する。

| 確認したいこと | 見る場所 |
|---|---|
| API 全体の 5xx・呼び出し数・Latency | CloudWatch コンソール → メトリクス → `AWS/ApiGateway` → `ApiId` で `monsternote-dev` の HTTP API を選択 |
| 関数ごとの呼び出し数・エラー・実行時間 | CloudWatch コンソール → Lambda → 対象の関数 → 「モニタリング」タブ（`Invocations`・`Errors`・`Duration`・`Throttles`） |
| 表ごとの読み書き・スロットリング | DynamoDB コンソール → 対象の表 → 「モニタリング」タブ |
| 現在のアラームの状態 | CloudWatch コンソール → アラーム（3 個。`alarms.md` 参照） |
| ルートごとの詳しい状況・業務イベントの内訳 | CloudWatch Logs Insights（保存済みクエリ。`log-queries.md`） |

## 3. 本ステージの提案: 無料枠に収まる単一のダッシュボード（人が承認し、実装済み）

U1〜U3 時点（関数が 5〜11 個、スタックが最小構成）では「標準画面で十分」という判断は妥当だった。しかし U1〜U4 の完了後、`dev` には実際に 12 関数・14 表・30 ルート・3 アラームが動いている（`environment-inventory.md`）。関数ごとに標準画面を 1 つずつ開いて確認するコストが Unit 追加のたびに増えており、**この規模になった今、1 つのダッシュボードにまとめる価値が出てきた可能性がある**。

CloudWatch ダッシュボードは最初の 3 個まで無料（現在 0 個使用中）であり、追加しても project.md の Forbidden（常時課金リソース）には抵触しない。人に確認し（記録: f6a5a28c）、追加する判断を得た。以下の構成で`infra/lib/api-stack.ts`に`OperationsDashboard`として実装した（`masahiro-cloudwatch-monsternote-operations`）。既存のアラーム・メトリクスだけを使い、新しい AWS リソースは増やしていない。`infra/test/stacks.u1.test.ts`に構成試験を追加済み。

### 提案するウィジェット構成（1 枚）

| ウィジェット | 中身 |
|---|---|
| 1. API の健康状態 | `AWS/ApiGateway` の `5xx`・`4xx`・`Count`・`Latency`（既存のアラームと同じ指標を流用） |
| 2. 関数グループ 0 のエラー（9 関数） | `masahiro-cloudwatch-monsternote-lambda-errors-0` が使っている数式そのもの（関数ごとの `Errors` を積み上げ棒グラフで） |
| 3. 関数グループ 1 のエラー（3 関数） | 同上、グループ 1 |
| 4. アラームの状態 | 3 個のアラームの状態（Alarm Status Widget） |
| 5. EventBridge の配達失敗 | `AWS/Events` の `FailedInvocations`（ルール 4 個分。現在どの Unit の設計にも監視の言及が無い既存のギャップ。§4 参照） |

このウィジェット 5 個はすべて既存の指標・既存のアラームの再利用であり、新しい CloudWatch 独自メトリクスやログメトリクスフィルタを作る必要がない（追加コストなし）。

## 4. 見つけたギャップ: EventBridge の配達失敗がどの画面にも出ていない（視認性はダッシュボードで解決・アラームは見送り）

U1 reliability-design は「EventBridge の配達（受け手への配達）は標準のやり直し（最大 24 時間・185 回）に任せ、DLQ もアラームも作らない」と明記している（受け入れたリスク）。これは「配達そのもの」についての判断だが、**配達が最終的に失敗した件数（`FailedInvocations`）を見る手段そのものが、ダッシュボードにもログクエリにも一切用意されていなかった**。

人に確認し（記録: f6a5a28c）、次のとおり判断を得た:
- **ダッシュボードのウィジェット5（視認性。アラームではない）としては追加する**。185回のやり直しをすべて使い切って最終的に失敗したイベントがあれば、ダッシュボードを見れば気づける。
- **新しいCloudWatchアラーム（人に自動で知らせる仕組み）としては追加しない**。既存の3つの関数系アラームで十分とする判断。DynamoDBのスロットリング監視についても同様に追加しないと判断された。

## Assumptions & Open Questions

None.
