<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T04:32:17Z — U4 は新しい AWS サービスを使わない最後の Unit。tech-stack-decisions には新しい表（AuditEntry・AdminCounter）と最初の管理者の作成の使い方だけを書いた。
- 2026-11-24T04:32:17Z — U2・U3 の NFR14 で見つかった「知らせの名前が約束 C15 の形と一致しない」曖昧さ（レビュー R-03）を踏まえ、U4 の NFR14.6 は最初から `audit.recorded` の `action` に入れる形で書いた。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-24T04:50:00Z — レビュー R-01 の直し: 管理者の画面（AdminApp）の対応機器を、要件にも U1 の NFR9 にも定めがないまま進めていた。新しい要件（NFR9.5）を立てて、パソコンの Chrome・Edge に限定した（試験運用の管理者はパソコンでの利用を想定）。
- 2026-11-24T04:50:00Z — レビュー R-02 の直し: NFR6.5 を U1 の NFR6.3 とほぼ同じ内容で新設していたが、新しい秘密情報の扱いを何も足していなかった。U3 が NFR6 を正しく N/A にした前例と合わせ、節ごと N/A にした。
- 2026-11-24T04:50:00Z — レビュー R-03 の直し: NFR14.6 で有効化（account.enabled）の記録を BR12.5 のせいにしていたが、BR12.5 の文には有効化が明示されていない。無効化と対になる操作として扱う、と理由を明記した。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-24T04:32:17Z — 管理者のログイン失敗の扱いを U1 と同じ（標準の保護）にした（Q1-A）。追加の締め出しの設定は守りを強めるが、試験運用の規模（管理者は数人）では複雑さに見合わない。
- 2026-11-24T04:32:17Z — AdminCounter のずれの見張りを NFR の目標にしない（Q3-A）。アラームにすれば早く気づけるが、無料枠のアラーム 10 個を使わずに済ませる方を選んだ。機能設計の「画面を開いたときに数え直す」という回復手段がすでにある。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
