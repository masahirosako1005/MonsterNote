<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T09:50:00Z — U1 の種類と雌雄を 1 画面にまとめた（細い版のステップを減らす）。U2 で 1 画面 1 項目に分ける。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-23T09:50:00Z — 捕獲日時を、Q2 の「スマホの時刻」ではなくサーバーが受け付けた時刻にした（レビュー R-06 のスマホの時計のずれへの対応。意味は「送信の時点」で同じ）。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T09:50:00Z — 一覧（ReportCatalog）と確認の記録（Review）が別の知らせで作られるため、承認のときに記録がまだないことがある。待ってもらう 404 で扱った。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
