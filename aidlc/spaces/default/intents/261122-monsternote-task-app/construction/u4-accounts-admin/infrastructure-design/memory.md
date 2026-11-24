<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T09:45:57Z — U4のnfr-design/performance-design.mdは時間切れ15秒への統一を`review`・`reporting`・`duplicate-detection`の3関数にだけ明記していたが、削除の順番①（一覧）を担当する`catalog`関数も新しい削除の入口を持つため、U3のInfrastructure Designで学んだ教訓（reviewとcatalogは別関数）を踏まえ、`catalog`関数も同じ15秒に揃えた（Assumptionsに明記）。

## Deviations
- 2026-11-24T10:15:00Z — レビュー（iteration 1、READY）の指摘を受け、(1) U4のnfr-design/logical-components.mdがいまだ「Review関数（ReportCatalogを含む）」という誤った前提のままだったため（U3の訂正がU4には及んでいなかった）、同ファイルの表・構成図・テキスト代替を`review`・`catalog`の2関数に正しく分ける形に訂正した（Major）。(2) accounts関数に付与していたCognitoの`AdminUpdateUserAttributes`権限が、どの業務規則にも対応せず最小権限の原則に反していたため削除し、無効化・有効化はDynamoDB側の書き換えだけで行うことを明記した（Minor）。(3) traceability.jsonから漏れていたNFR6.3（スクリプトの秘密情報、変更なし）を追加した（Minor）。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
