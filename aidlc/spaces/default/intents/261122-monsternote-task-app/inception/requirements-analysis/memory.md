<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T06:15:00Z — Q11 の手入力を許す回答から、手入力の報告に「手入力」の印を付ける（FR2.5）・位置は地図で指すと補い、まとめで確認を得た。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-23T06:15:00Z — Q4 の交付金の項目（成獣／幼獣・捕獲の方法）を入れるため、承認済みの画面案にないステップを FR5.2 で加えた。画面への反映は OQ-2 で後のステージへ。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T06:15:00Z — Q3/Q11 で保存済みの写真を許したため、写真の使い回しはアプリだけでは防げない（A-2）。依頼元の目視に頼る。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T06:15:00Z — レビュー（advisory）は NOT-READY: FR5.2 と NFR7 の矛盾、自動判別の合否基準、手入力の検証規則、管理者の資格情報、取り消しの秒数などが未定義。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
