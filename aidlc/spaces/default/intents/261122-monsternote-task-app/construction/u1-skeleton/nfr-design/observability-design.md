# Observability Design（監視の設計）— U1 `u1-skeleton`

入力: `construction/u1-skeleton/nfr-requirements/observability-requirements.md`（NFR10.6〜NFR10.8・NFR11.4〜NFR11.6）、`construction/u1-skeleton/nfr-requirements/reliability-requirements.md`（NFR10.1）、logical-components.md、reliability-design.md、nfr-design-questions.md（Q6）。

## 1. ログ

- 共通のロガー（構造化した JSON）を全関数で使う。項目: `timestamp`、`level`、`function`、`requestId`（API Gateway の requestId、知らせの処理では eventId）、`route`、`status`、`durationMs`、`errorCode`、`accountId`（利用者の ID だけ）。
- 出さない項目: 氏名、位置、従事者番号、トークン、URL（security-design の NFR5.5）。
- 関数のロググループの保存期間は 14 日（NFR11.6）。
- 原因の追跡は、画面に表示するエラーの「問い合わせ番号」（requestId）から、CloudWatch Logs Insights で探す（X-Ray は使わない）。

## 2. 指標（SLI）と目安（SLO）

| 指標 | 取り方 | 目安 |
|---|---|---|
| API の成功の割合 | API Gateway の 5xx の数 ÷ 全体の数（標準のメトリクス） | 30 日間で 99% 以上（NFR10.1） |
| API の応答時間 | API Gateway の Latency の p95 | 一覧・詳細・承認 3 秒、送信 10 秒（NFR2） |
| 関数のエラー | Lambda の Errors | — |
| 知らせの送信の失敗 | Reporting の関数のログの `errorCode=EVENT_PUBLISH_FAILED` | ログで確かめる（アラームなし。Q6） |

## 3. アラーム

| アラーム | 条件 | 知らせ先 |
|---|---|---|
| API の 5xx | 5 分間で 5xx の割合が 5% を超え、かつ呼び出しが 5 回以上（2 つの期間のうち 1 つ） | SNS のトピック → 開発者のメール |
| 関数のエラー | 5 分間で全関数のエラーの合計が 3 回以上 | 同上 |

- アラームは 2 つ（無料の 10 個以内）。メールの宛先はデプロイのときに渡し、リポジトリに書かない。
- ダッシュボードは作らない（CloudWatch のダッシュボードは 3 つまで無料だが、試験運用ではメトリクスの画面で足りる）。

## 4. 監査の記録

- U1 の部品は、操作（報告の送信、承認）の `audit.recorded` を EventBridge に送る。受け手（AuditLog）は U4 で作る。U4 までの知らせは受け手がないため残らない（受け入れたリスク。試験運用の前に U4 ができる）。

## Assumptions & Open Questions

- 画面に表示する「問い合わせ番号」は、API の応答のヘッダーから受け取る。 [assumption]
