## Q1. [運用] ゼロコストのCloudWatchダッシュボードを追加するか

これまでU1〜U4の各Unitは一貫して「ダッシュボードは作らない。標準のメトリクス画面とLogs Insightsのクエリで見る」という方針だったが、U4まで完成した今（12関数・14表・30ルート・3アラーム）、関数ごとに標準画面を開く手間が増えている。既存のアラーム用指標を再利用するだけで新規課金は無い単一のダッシュボードを追加するか。

A. 追加する
B. 追加しない（これまでの方針を継続し、必要な時だけCloudWatchコンソールで個別に確認する）
X. Other (please specify)

[Answer]: A（2026-11-26T02:40Z・AskUserQuestionで確認・記録f6a5a28c）

## Q2. [運用] DynamoDB・EventBridgeの新しい監視アラームを追加するか

本ステージの調査で、DynamoDBのスロットリングとEventBridgeの配達失敗（最大24時間・185回のやり直しを使い切った件数）のどちらも、現状どのUnitの設計にも監視が無いことが分かった。Operationフェーズの指針「新しい部品には必ず健全性指標とエラー率指標を1つずつ」の抜けにあたる。CloudWatchの無料のアラーム枠はまだ残っているが、これまでの「アラームは増やさない」という各Unitの一貫した方針を上書きする決定になる。新しいアラームを追加するか。

A. 追加する
B. 追加しない（既存の3つの関数系アラームで十分とする。EventBridgeの配達失敗は、アラームではなくダッシュボードのウィジェットとして視認性だけ確保する）
X. Other (please specify)

[Answer]: B（2026-11-26T02:40Z・AskUserQuestionで確認・記録f6a5a28c）

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
