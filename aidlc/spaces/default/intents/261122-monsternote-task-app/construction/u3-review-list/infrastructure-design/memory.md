<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T09:32:11Z — U3はNFR Designの時点ですでに「新しいAWSサービス・表・関数を作らない」と決めていたため、Infrastructure Designでは既存のMonsterNote-Api-dev・Data-devスタックへの拡張（APIの道の追加、表への項目追加）だけを記述した。新しい決定を要する点がなかったため、質問は1問（前提の確認）にとどめた。

## Deviations
- 2026-11-24T09:50:00Z — レビュー（iteration 1、NOT-READY）で、U3のnfr-design（Q1）が前提にしていた「ReviewとReportCatalogはすでに同じ関数にまとまっている」が事実誤認（U1のinfrastructure-specification.mdでは実際には別々の`review`・`catalog`関数）と判明した（Critical：このままだとcatalog専用のReportListItemsへのIAM権限をreview関数が持たず実行時にAccessDeniedになる）。nfr-designの文章は書き換えず、Infrastructure Design側でU1の実際の関数境界に沿った配置（却下・取り消し・状態読み出しはreview関数のまま、一覧・絞り込みは既存のcatalog関数）に訂正し、nfr-designの本来のねらい（新しい関数を増やさない）はそのまま満たした。あわせて、GET /v1/catalog/my-reportsの道の抜け（Major）とtraceability.jsonの実在しないNFR9.4という誤ったID（performance-design.mdの範囲表記「NFR7.5〜NFR9.4」を誤って拾ったもの。Minor）も直した。
- 2026-11-24T10:20:00Z — ステージ全体のゲートで、決定論的なtraceabilityセンサーが「NFR9.4がupstream_idsにない」と指摘した。レビュアー（LLM）は逆に「NFR9.4は実在しないIDなので削除すべき」と判断していたが、センサーの根本原因を調べたところ、nfr-design/performance-design.mdの入力citation行がU2のパターンをコピーしたまま「NFR7.5〜NFR9.4」という誤った範囲表記を残していたことが分かった（実際の最後の項目はNFR7.7）。traceability.json側で帳尻を合わせるのではなく、根本原因である引用の範囲表記そのものを「NFR7.5〜NFR7.7」に修正し、センサーを再実行してpassを確認した。
- 2026-11-24T10:05:00Z — iteration 2（READY）で新たに「修正がInfrastructure Design側の文書には行き渡ったが、同じU3のnfr-design側の複数ファイル（logical-components.md・scalability-design.md・observability-design.md）には訂正前の『すべて同じReview関数』という前提がそのまま残っている」という指摘（Minor、実害なし）を受けた。nfr-designは確定済みだが、このプロジェクトでは過去にも確定済み文書への軽微な訂正を認めてきた前例（U4のBR11.2対応）があるため、該当する3ファイルを直接修正した（logical-components.mdの構成図・表・説明文を`review`・`catalog`の2関数に正しく分け、scalability-design.md・observability-design.mdの「同じReview関数」という記述も訂正）。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
