<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-24T09:05:00Z — レビュー（iteration 1、NOT-READY）の指摘を受け、(1) functional-spec/rules.mdのUC14・BR8.9が定める約束C5（GET /v1/duplicates/{reportId}）がAPI Gatewayの道の一覧から丸ごと抜けていたため追加した（Critical）。(2) security-design.mdのNFR4.8の表が「ReportingはJWT転送、DuplicateDetectionだけがADR-011」と区別しているのに、infrastructure-specification.mdが両方ADR-011と書いていた誤りを訂正した（Major）。(3) monitoring-design.mdのreporting関数の時間切れ近接KPIが9秒への変更後も8秒基準のままだったため更新した（Minor）。

## Tradeoffs
- 2026-11-24T08:53:40Z — OpenStreetMapの公式タイルサーバーを直接使う（Q1-A）。利用規約上の懸念はあるが、試験運用の規模（利用者20人以下）では実務上の問題は小さいと判断し、無料枠のある提供サービス（Q1-B、アカウント管理が増える）より単純さを優先した。利用方針の変更があれば切り替える前提を明記した。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
