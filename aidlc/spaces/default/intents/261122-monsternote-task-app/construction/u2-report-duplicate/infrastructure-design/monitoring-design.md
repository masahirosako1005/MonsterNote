# Monitoring Design（監視の構成）— U2 `u2-report-duplicate`

入力: `construction/u2-report-duplicate/nfr-design/observability-design.md`、`construction/u1-skeleton/infrastructure-design/monitoring-design.md`（U1 の設計。アラーム・ログの形をここで引き継ぐ）、infrastructure-specification.md。

U1 のアラーム 2 つ（API の 5xx、関数のエラー）をそのまま使う。U2 でアラームは増やさない（observability-design の NFR10.18、Q3-A の踏襲）。

## Metrics & KPIs（U2 で足すもの）

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| 判別の応答時間 | Lambda のログ（`durationMs`、カスタムの構造化ログ） | 参考（アラームなし）。3 秒の時間切れに対する実測の確認用 | NFR2.8 |
| 判別の上限超過の回数 | Lambda のログ（`errorCode=DETECTION_LIMIT_REACHED`） | 参考（アラームなし） | NFR12.5 |
| 重複判定の読み出し件数 | Lambda のログ（`readCount`） | 参考（アラームなし）。500 件の上限に近づいていないかの確認用 | NFR3.5 |
| 既存の 2 つのアラームの対象範囲 | Lambda `Errors`（全関数の合計） | 変更なし（5 分で 3 回以上） | U2 の新しい関数（`duplicate-detection`・`settings`）もこの合計に自動的に含まれる |
| 関数の時間切れの近さ（更新） | Lambda `Duration` の最大 | `reporting` は **9 秒の 80%**（U1 の monitoring-design は 8 秒の 80% だったが、U2 の performance-design で 9 秒に変更されたため更新）。`duplicate-detection`・`settings` は従来どおり 10 秒・8 秒の 80% | reliability-design・performance-design |

## Alerts

U1 の 2 つのアラーム（`masahiro-cloudwatch-monsternote-api-5xx`・`masahiro-cloudwatch-monsternote-lambda-errors`）をそのまま使う。新しいアラームは作らない（無料枠の 10 個のうち 2 個を使用中のまま）。

## SLIs / SLOs（U2 で足すもの）

| SLI | SLO target | Measurement window |
|---|---|---|
| 写真の受け付け（`POST /v1/photos`） | p95 3 秒以内 | 30 日 |
| アップロードの完了（`POST /v1/photos/{id}/complete`） | p95 6 秒以内 | 30 日 |
| 送信（`POST /v1/reports`） | p95 10 秒以内 | 30 日 |

## Logs & Tracing（U2 で足すもの）

| 項目 | 構成 |
|---|---|
| 判別のログ | `photoId`・`outcome`・`confidence`（detected のとき）・`failureReason`（undetected のとき）・`durationMs`。生のラベルと保存場所のキーは出さない（observability-design §1） |
| 重複判定のログ | `phase`・`readCount`・`matchCount`・`durationMs`・`limitReached` |
| 新しい関数のロググループ | `duplicate-detection`・`settings` の 2 つを CDK で作成、保存期間 14 日（U1 と同じ既定） |
| Logs Insights のクエリ例（保存） | observability-design §2 の 4 つのクエリ（判別の上限超過、判別の失敗率、重複判定の読み出し件数の分布、送信前問い合わせの失敗）を CDK の `QueryDefinition` としてコンソールに保存する |
| ダッシュボード | 作らない（U1 の方針を継続。標準のメトリクス画面と Logs Insights のクエリで見る） |

## Assumptions & Open Questions

- Logs Insights の保存済みクエリ（`QueryDefinition`）は無料のリソースのため、費用には影響しない。 [assumption]
