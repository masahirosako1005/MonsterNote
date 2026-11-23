<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T09:40:00Z — Q1「U2 を先に」と Q7「同時に」を、U2 の中で判別・重複を先に作る形で両立させた。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-23T09:40:00Z — 要件 FR3.5 の確かめる時期を Build and Test から試験運用へ変更（Q8）。requirements.md は書き換えず、bolt-plan の 4 に変更として記録した。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T09:40:00Z — U2 と U3 を同時に進める（stage-major・swarm）ことで期限を優先し、取り込みの衝突のリスクを受け入れた。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T09:40:00Z — 検証のコマンド npm run verify はまだ存在しない。U1 で作る。AWS の dev での確認は含まない。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
