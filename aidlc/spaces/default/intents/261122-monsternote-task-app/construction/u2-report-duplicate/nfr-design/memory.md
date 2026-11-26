<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T04:50:36Z — U2 の NFR 要件には U1 から引き継いだ ID（変更なしのもの）が多く含まれていた。traceability では、設計を新しく足したものだけ OK にし、引き継いだだけのものは N/A（理由に「U1 の設計を引き継ぐ」と明記）にして区別した。
- 2026-11-24T06:10:00Z — レビュー（iteration 1）の指摘 3 件を反映: (1) `DetectionRateLimit` の初回の書き込みを `if_not_exists` を使った 1 回の `UpdateItem` に明記し、U4 の AdminCounter と同じ「数えてから書く」競合を避けた。(2) 写真の保存条件（NFR10.14）を、時刻の比較ではなく「写真の記録がまだあるか」という存在確認（`attribute_exists`）に直し、functional-design の BR2.13・BR2.14 の条件と一致させた。(3) `logical-components.md` の構成図で、Reporting・DuplicateDetection が Setting の表を直接読む線を消し、どちらも Settings 関数を（ADR-011 の部品の身元の証明で）呼ぶ形にし、security-design の NFR4.8 の認可の表（呼び出し元を関数単位で区切る前提）と一致させた。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-24T04:50:36Z — U1 で決めた送信の関数の時間切れ（8 秒）を、U2 の処理（重複の問い合わせ 2 秒など）を足すと超えるため、U2 で 10 秒に引き上げた。U1 の reliability-design の値を上書きする変更で、Code Generation で CDK の設定を直す必要がある。
- 2026-11-24T06:10:00Z — レビュー（iteration 1、NOT-READY）の指摘を受け、上の 10 秒への引き上げを取り消し、**9 秒**に訂正した。nfr-requirements の「送信の 10 秒の内訳」表（合計約 8 秒）を design 側で二重に数えていたのが原因（U1 の 5.8 秒の予算に、すでにその中に含まれていた設定の読み出し・重複の問い合わせを再び足していた）。内訳を nfr-requirements のものに統一し、8 秒の時間切れとの差（0.4 秒）が心もとないため 9 秒に引き上げる、という筋に直した。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-24T04:50:36Z — サーキットブレーカーを入れない（Q1-A）。試験運用の規模では、判別の3秒の時間切れで十分な歯止めになり、状態管理の複雑さを避けた。
- 2026-11-24T04:50:36Z — 重複判定の500件の打ち切りを「ページを読み切ってから」にした（Q3-A）。ちょうど500件で切るより読む量はわずかに増えるが、同じ日の中で判定が偏らない。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
