# Monitoring Design（監視の構成）— U3 `u3-review-list`

入力: `construction/u3-review-list/nfr-design/observability-design.md`、`construction/u1-skeleton/infrastructure-design/monitoring-design.md`（U1 の設計。ここに足す）、infrastructure-specification.md。

U1 のアラーム 2 つ（API の 5xx、関数のエラー）をそのまま使う。U3 でアラームは増やさない（observability-design の NFR10.24）。

## Metrics & KPIs（U3 で足すもの）

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| 却下・取り消しの件数 | Lambda のログ（構造化ログ） | 参考（アラームなし） | NFR10.24・NFR10.25 |
| 同時操作で弾かれた回数 | Lambda のログ（`errorCode=ALREADY_DECIDED`／`ALREADY_UNDONE`／`UNDO_EXPIRED`） | 参考（アラームなし） | NFR11.17 |
| 絞り込みの上限超過の回数 | Lambda のログ（`errorCode=FILTER_LIMIT_REACHED`） | 参考（アラームなし） | NFR11.18 |
| 取り消しの知らせの送信失敗 | Lambda のログ（`errorCode=EVENT_PUBLISH_FAILED`） | 参考（アラームなし）。一覧の表示が古いまま残る可能性の手がかり | reliability-design.md §2（受け入れたリスク） |
| 既存の 2 つのアラームの対象範囲 | Lambda `Errors`（全関数の合計） | 変更なし | `review`・`catalog` 関数の拡張部分もこの合計に自動的に含まれる |

## Alerts

変更なし（U1 の 2 つのアラームのみ）。

## SLIs / SLOs（U3 で足すもの）

| SLI | SLO target | Measurement window |
|---|---|---|
| 却下（`PUT /v1/reviews/{id}/decision`） | p95 3 秒以内 | 30 日 |
| 取り消し（`POST /v1/reviews/{id}/decision/undo`） | p95 2 秒以内 | 30 日 |
| 絞り込み一覧（`GET /v1/catalog/reports`） | p95 3 秒以内 | 30 日 |

## Logs & Tracing（U3 で足すもの）

| 項目 | 構成 |
|---|---|
| ログの項目 | observability-design.md §1 の表のとおり（`reportId`・`reason`・`accountId`・`durationMs`・`errorCode` など） |
| Logs Insights のクエリ例（保存） | observability-design.md §2 の 2 つのクエリ（却下・取り消し・409 の回数、絞り込み上限）を CDK の `QueryDefinition` として保存する |
| ダッシュボード | 作らない（U1 の方針を継続） |

## Assumptions & Open Questions

特になし。
