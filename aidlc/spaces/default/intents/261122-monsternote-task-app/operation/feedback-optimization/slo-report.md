# SLO Report — Feedback & Optimization

入力: `operation/observability-setup/slo-config.md`（SLO target一覧）、`operation/performance-validation/test-results.md`（実測結果）、`operation/observability-setup/alarms.md`（エラー率側の監視）。

## 1. SLO達成状況（実測値との照合）

| SLI | SLO target | 実測（max。`performance-validation/test-results.md`） | 判定 |
|---|---|---|---|
| 一覧・詳細 Latency p95 | 3秒以内 | 1993ms（n=3） | 達成 |
| 送信 Latency p95 | 10秒以内 | 781ms（n=3） | 達成 |
| 承認 Latency p95 | 3秒以内 | 699ms（n=2） | 達成 |
| 写真の受け付け Latency p95 | 3秒以内 | 166ms（n=6） | 達成 |
| アップロード完了 Latency p95 | 6秒以内 | 521ms（n=6） | 達成 |
| 却下 Latency p95 | 3秒以内 | 419ms（n=1） | 達成 |
| 取り消し Latency p95 | 2秒以内 | 181ms（n=1） | 達成 |
| 絞り込み一覧 Latency p95 | 3秒以内（上限2,000件まで） | 202ms（n=2。通常規模のみ） | 達成（上限近くは未計測） |
| アカウント一覧・操作記録一覧 Latency p95 | 3秒以内 | 177ms／1902ms（n=3） | 達成 |
| アカウント作成・パスワード再設定 Latency p95 | 3秒以内 | 1339ms（n=2） | 達成 |
| 「すべて削除」各入口 Latency p95 | 10秒以内 | 未計測（破壊的操作のため対象外。`performance-validation/nfr-validation-matrix.md`） | 対象外 |
| API全体の成功率（NFR10.1） | 99%以上／30日 | 未集計（§2参照） | 不明 |

**誠実さのための注記（`performance-validation/test-results.md` §5から継承）**: 各SLIのサンプル数は`n=1`〜`6`と非常に少ない。「p95」という名前を使っているが、統計的に意味のある95パーセンタイル値ではなく、実質的には「数回試した中の最大値」に近い。今回の結果は「目標を大きく超える兆候は無かった」という軽い確認であり、将来の実利用者数の増加に対する保証ではない。

## 2. API全体の成功率（NFR10.1）はまだ集計していない

`slo-config.md` §3.1が定める計測方法（CloudWatchコンソールでピリオドを30日に広げ、`100 - (SUM(5xx) / SUM(Count) * 100)`を確認）は、**実機デプロイから日が浅く（本ステージの時点で初回の`cdk deploy`からまだ数時間）、30日分のデータがまだ存在しない**。したがって本ステージでは集計できない。次回のFeedback & Optimizationサイクル、または運用が数週間経過した時点で確認することを申し送る（`feedback-loop.md`参照）。

## 3. エラーバジェットの消費状況

本ステージの時点で、3つのアラーム（`alarms.md`）はいずれも`health-check-report.md`確認時点から継続して`OK`のままであり（`incident-response/runbooks.md`・インシデント記録に新規の`ALARM`遷移の記録なし）、エラーバジェットの消費は実質0。ただし、これは「問題が起きていない」ことの確認であって、「エラー率が継続的に測定・記録されている」ことの確認ではない（§2と同じ理由。30日分のデータがまだ無い）。

## Assumptions & Open Questions

None（§2の「まだ測れない」はSLO未達ではなく、デプロイ直後で測定窓が経過していないという時間的な制約であり、人の判断を仰ぐ事項ではない）。
