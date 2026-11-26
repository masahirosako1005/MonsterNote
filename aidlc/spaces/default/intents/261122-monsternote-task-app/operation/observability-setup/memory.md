<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-26T03:02:02Z — X-Ray・CloudWatch Anomaly Detectionは今回の利用規模（開発者1人＋少人数の試験運用）では追加しないと判断した（`tracing-config.md`・`anomaly-config.md`）。キーワードどおり導入するのではなく、実際のトラフィック量・既存の相関手段（reportId）で足りるかを評価した結果。

## Deviations
- 2026-11-26T03:02:02Z — U1〜U4のmonitoring-designが一貫して「ダッシュボードは作らない」としていた方針を、本ステージで見直しの提案として覆した（人の承認: f6a5a28c）。U4完了時点で12関数・14表・30ルートに増えており、標準画面を関数ごとに開く手間がUnit追加のたびに増えていたため。

## Tradeoffs
- 2026-11-26T03:02:02Z — EventBridgeのFailedInvocationsは、新しいアラーム（人に自動で知らせる）ではなく、ダッシュボードのウィジェット（視認性のみ）として追加した。人がDynamoDB/EventBridge向けの新規アラームを増やさないと判断した（f6a5a28c）ため、「気づける手段はほしいが、通知は増やさない」という中間案を選んだ。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-26T03:02:02Z — requestIdがLambda間の直接呼び出しやEventBridgeのイベントに一切伝播しておらず、reportIdだけが相関キーになっている（U1から存在した設計上の制約。`tracing-config.md`）。アプリケーションコードの変更が要るため本ステージの範囲外とし、Feedback & Optimizationフェーズでの検討に持ち越す。
