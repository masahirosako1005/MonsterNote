<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T06:40:00Z — 取り消し（NFR2.14、2秒以内）の絶対の最悪値（書き換え・知らせの送信とも上限いっぱい）を計算すると約2.8秒になり、目標の2秒を上回る。EventBridgeの「1回0.5秒」は呼び出しごとの時間切れの上限であって普通の呼び出し時間ではないため、NFR2.14が測るp95では収まるという整理にした（U1の承認の内訳〈NFR2.3〉と同じ考え方）。dev実測で崩れたときの見直し先（非同期化）もAssumptionsに記録した。
- 2026-11-24T08:12:13Z — 上の整理は、全Unit共通のNFR Designステージゲートでレビューの指摘（R-01、Major）として残った。p95頼みの整理は実測によらない希望的な説明であり、NFR2.14自身の根拠（「書き換えだけだから承認より速い」）と設計の実際の処理経路（知らせの送信を待つ、承認・却下と同じ届け方）が一致していないという指摘を受け、人の判断で「いま設計を直す」を選んだ。取り消しだけ知らせの送信を1回だけ試し、結果を待たずに応答する届け方に変更し、最悪値を約1.5秒（2秒の目標に対して0.5秒の余裕）に収めた。あわせて、reliability-design.mdがReviewDecisionの事前作成の根拠として誤って引用していたBR3.7を、正しいU1のBR3.1に差し替えた（R-02、Minor）。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Deviations
- 2026-11-24T08:25:00Z — iteration 2（READY）で新たに「取り消しの知らせが1回の送信失敗で届かなかった場合、一覧（ReportListItemは知らせだけで更新する作り）がその行だけ古いまま残りうる。承認・却下より取り消しの方がこの可能性が高いのに救済策・受け入れリスクの明記がない」という指摘を受けた。再送の回数を増やす再設計（2秒の予算内に収めるのは難しい）ではなく、詳細（ReviewDecisionを直接読むため常に正しい）と一覧（知らせ頼み）の違いを明記した上で、受け入れたリスクとして文書化した（取り消し自体の頻度の低さ×送信失敗率の低さで、試験運用の規模では実害が小さいと判断）。observability-design.mdにeventSent・EVENT_PUBLISH_FAILEDのログ項目も追加した。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
