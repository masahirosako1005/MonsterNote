# Monitoring Design（監視の構成）— U4 `u4-accounts-admin`

入力: `construction/u4-accounts-admin/nfr-design/observability-design.md`、`construction/u1-skeleton/infrastructure-design/monitoring-design.md`（U1 の設計。ここに足す）、`construction/u2-report-duplicate/infrastructure-design/monitoring-design.md`（時間切れの近さKPIの更新パターン）、infrastructure-specification.md。

U1 のアラーム 2 つをそのまま使う。U4 でアラームは増やさない（NFR10.31）。

## Metrics & KPIs（U4 で足すもの）

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| アカウントの作成・無効化の件数 | Lambda のログ | 参考（アラームなし） | NFR10.31・NFR10.32 |
| 管理者の無効化が拒まれた回数 | Lambda のログ（`errorCode=CANNOT_DISABLE_SELF`／`LAST_ADMIN`） | 参考（アラームなし） | NFR11.22 |
| 「すべて削除」の実行回数と結果 | Lambda のログ（`componentName`・`deletedCount`） | 参考（アラームなし） | NFR11.23 |
| 設定の変更の回数 | Lambda のログ | 参考（アラームなし） | NFR11.24 |
| 関数の時間切れの近さ（更新） | Lambda `Duration` の最大 | `catalog`・`review`・`duplicate-detection`・`reporting` は **15 秒の 80%**（U4 で統一）。`accounts`・`settings` は変更なし（8 秒の 80%）。`audit-log` は 10 秒の 80% | reliability-design・performance-design |
| 既存の 2 つのアラームの対象範囲 | Lambda `Errors`（全関数の合計） | 変更なし | `audit-log` 関数もこの合計に自動的に含まれる |

## Alerts

変更なし（U1 の 2 つのアラームのみ）。

## SLIs / SLOs（U4 で足すもの）

| SLI | SLO target | Measurement window |
|---|---|---|
| アカウントの一覧・操作の記録の一覧 | p95 3 秒以内 | 30 日 |
| アカウントの作成・パスワードの再設定 | p95 3 秒以内 | 30 日 |
| 「すべて削除」の各入口 | p95 10 秒以内 | 30 日 |

## Logs & Tracing（U4 で足すもの）

| 項目 | 構成 |
|---|---|
| ログの項目 | observability-design.md §1 の表のとおり |
| 新しい関数のロググループ | `audit-log` を CDK で作成、保存期間 14 日 |
| Logs Insights のクエリ例（保存） | observability-design.md §2 の 2 つのクエリを CDK の `QueryDefinition` として保存する |
| ダッシュボード | 作らない（U1 の方針を継続） |

## Assumptions & Open Questions

特になし。
