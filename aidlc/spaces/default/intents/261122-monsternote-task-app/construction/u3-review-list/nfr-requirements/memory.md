<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T00:40:00Z — U3 は新しい技術を選ばない Unit。tech-stack-decisions には U1・U2 の決定の使い方の補いだけを書いた（条件付き書き込みの徹底、時刻の扱い）。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-24T01:00:00Z — レビュー R-01 の直し: NFR11.17 を書いたとき、BR3.10（取り消しの成功で確認の記録を消す）を見落とし、「確認済みの人を記録から読む」とだけ書いていた。409 ALREADY_UNDONE（本人の二重送信）の時点では記録がすでに空になっているため、呼び出した本人の認証情報から得る、と直した。
- 2026-11-24T01:00:00Z — レビュー R-02 の直し: NFR12.9（メモリを増やさない）と NFR2.12（届かなければ上限を下げる）が、機能を変えない対処法を残さないまま決まっていた。U1 の「重い処理は 256 MB」の例外をここにも当て、メモリを先に試す順番にした。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-24T00:40:00Z — 絞り込みを掛けた一覧も 3 秒以内を守る（Q1-A）。5 秒にゆるめれば安全マージンは増えるが、試験運用の規模では届かない見込みなので、U1 と同じ目標を保った。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-24T00:40:00Z — NFR2.12 の応答時間は見積もりであり、dev での実測が必要。届かなければ読む上限（2,000 件）を下げる。
- 2026-11-24T01:00:00Z — レビュー R-03 で、U2 の observability-requirements.md の NFR14.2 にも同じ曖昧さ（`report.submitted`・`duplicate.suspected` という名前の知らせが、約束 C15 の `audit.recorded` の `action` の値なのか、別の知らせなのか）が見つかった。U2 の NFR は確定済み（READY）のため、文書の表現のために再レビューは起こさず、Code Generation で両方の文書を実装するときに `audit.recorded` の `action` に入れる形で統一する。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
