<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T08:50:00Z — Q2 B の 4 Unit に名前のないストーリーを近い Unit に入れ、まとめで確認を得た。U3 は知らせの形（Contract Design）に合わせて作るとし、U2 と依存させなかった。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-23T08:50:00Z — traceability.json の target は Unit 1 つだけのため、U1 と U3 にまたがる US4.1 は U1 を書いた（story-map には両方）。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T08:50:00Z — レビュー（READY）の Major: U1 で同意・従事者番号の確認をどう通すか（手順書で登録済みのアカウントを作る、など）。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
