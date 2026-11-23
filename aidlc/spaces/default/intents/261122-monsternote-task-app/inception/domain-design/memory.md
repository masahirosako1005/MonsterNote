<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T06:55:00Z — Q5 B（3 つのアプリ）を受け、共通部分を UiKit にまとめると補い、まとめで確認を得た。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T06:55:00Z — 呼び出しの輪を避けるため、DuplicateDetection が報告の写し（ReportFootprint）を持つ。知らせの遅れで直前の報告を見落とす分は保存後の再判定で補う。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T06:55:00Z — レビュー NOT-READY: 写真・判別結果と報告の作成順、却下の取り消し時の索引、各部品の認可の経路、依頼元の一覧の合成の持ち主。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
