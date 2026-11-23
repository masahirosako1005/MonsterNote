# Monitoring Design（監視の構成）— U1 `u1-skeleton`

入力: `construction/u1-skeleton/nfr-design/observability-design.md`、`construction/u1-skeleton/nfr-design/reliability-design.md`、infrastructure-specification.md、infrastructure-design-questions.md（Q5）。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| API の 5xx の割合 | API Gateway（HTTP API）`5xx` ÷ `Count` | 5 分で 5% 超（呼び出し 5 回以上） | 99%／30 日の目安（NFR10.1）を割る前に気づく |
| API の応答時間 p95 | API Gateway `Latency` | 一覧・詳細・承認 3 秒、送信 10 秒 | NFR2 |
| 関数のエラー | Lambda `Errors`（全関数の合計） | 5 分で 3 回以上 | 処理の失敗（知らせの受け手を含む） |
| 関数の時間切れの近さ | Lambda `Duration` の最大 | 8 秒（API）・10 秒（受け手）の 80% | 時間の予算（reliability-design） |
| 流量の制限 | API Gateway の 429 の数 | 参考（アラームなし） | 流量の値の見直し |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| `masahiro-cloudwatch-monsternote-api-5xx` | メトリクスの計算式（metric math）: `IF(Count >= 5, 5xx / Count * 100, 0)` が 5 分間で 5 を超える（1 期間）。データがないときは「正常」扱い（treatMissingData: notBreaching） | 高 | SNS `masahiro-sns-monsternote-alarm` → 開発者のメール |
| `masahiro-cloudwatch-monsternote-lambda-errors` | 5 分間で全関数の Errors の合計 ≥ 3。データがないときは「正常」扱い（notBreaching） | 高 | 同上 |

SNS のメールの購読は、最初のデプロイのあとに届く確認のメールのリンクを開いて有効にする（cicd-pipeline の段階 5）。

メールの宛先は、デプロイのときに `-c alarmEmail=<宛先>` で渡す。値は `.gitignore` した `infra/.env.local` から読み、リポジトリに書かない（Q5）。

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| API の成功の割合（5xx ではない呼び出し ÷ 全体） | 99% 以上（目安） | 30 日のローリング |
| 一覧・詳細・承認の Latency の p95 | 3 秒以内 | 30 日 |
| 送信の Latency の p95 | 10 秒以内 | 30 日 |

## Logs & Tracing

| 項目 | 構成 |
|---|---|
| 関数のログ | 共通のロガー（JSON）。ロググループ `/aws/lambda/<関数>` を CDK で作り、保存期間 14 日 |
| API のアクセスログ | HTTP API のアクセスログをロググループに 14 日（requestId・route・status・latency。IP と利用者の情報は出さない） |
| 追跡 | X-Ray は使わない。requestId で CloudWatch Logs Insights から探す |
| 知らせの送信の失敗 | Reporting・Review の関数が `errorCode=EVENT_PUBLISH_FAILED` をログに出す（アラームなし。NFR Design の Q6） |
| ダッシュボード | 作らない（標準のメトリクスの画面で見る） |

## Assumptions & Open Questions

- アラームの 2 つは、無料の 10 個の範囲。U2〜U4 で足すときも 10 個以内に保つ。 [assumption]
