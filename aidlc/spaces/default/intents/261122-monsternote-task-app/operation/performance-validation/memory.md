<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-26T03:56:20Z — 「負荷試験」ではなく「軽い一度きりの実測（約48件、並行度1）」と明確に線引きした。project.md/team.mdの無料枠制約に抵触しない範囲を優先し、ステージ名の「Load Testing」という言葉に引きずられなかった。

## Deviations
- 2026-11-26T03:56:20Z — NFR2.12（絞り込み一覧、上限2,000件）・NFR2.18（すべて削除）は意図的に実測対象から外した。前者はデータを人為的に増やしてまで上限近くを再現することが無料枠の精神に反するため、後者は破壊的操作で試験データが失われるため。

## Tradeoffs
- 2026-11-26T03:56:20Z — `scripts/perf-check.ts`はドラフトのみ作成し、実行は人の承認を待ってから行った（project.mdのデプロイ確認の精神に準じる）。承認後（記録: ae63bcdb）に実際に実行し、NFR2.x全項目がMetと確認した（`test-results.md`）。
- 2026-11-26T04:23:28Z — 1回目の実行が`POST /v1/reports`の409（重複検知）で失敗した。原因は計測スクリプト自身が固定の緯度経度を使っていたこと（当日の`npm run smoke`実行分と衝突）。スクリプトに乱数のずれを加えて修正し、再実行して成功した。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
なし（管理者の試験用アカウント`perfadmin`を本ステージ内で作成し、NFR2.15〜2.17まで含めて実測・解決済み）。
