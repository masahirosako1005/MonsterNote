<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-23T05:36:00Z — Greenfield 初回のため org.md の 5 節を提案の既定値として使い、開発者 1 人・無料枠・公開リポジトリに合わせて具体化した。スコープ feature が `skeleton: on` なので、スケルトンは「ログイン → 写真 1 枚の報告 → 依頼元の承認」を提案した
- 2026-11-23T05:55:35Z — 統合: Q2 の「1」は Q14（Squash and merge）、Q3 の質問は Q15（手元／dev の試験の分け方＋スケルトンあり）で解決したものとして扱った

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-23T05:36:00Z — org.md の「マージで staging に自動デプロイ」を採らず、人の確認つき手動デプロイを提案した。project.md の Mandated（デプロイ前に必ず人に確認）と合わないため
- 2026-11-23T05:55:35Z — 下書きの提案（PR なし、test-after、識別子・コメントとも英語）から、人の答え（PR 毎回、TDD、コメントは日本語）に変えた

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-23T05:36:00Z — 環境は dev 1 つを提案。dev/prod 分離は安全だが、1 か月・数人の試験運用では手間と費用見通しの増加が上回ると判断した（P8 で人が決める）
- 2026-11-23T05:55:35Z — Q7（CI で E2E）と Q8・Q9（dev 1 つ・自動デプロイなし）の食い違いを Q16 で解決: CI は AWS を使わない E2E、本物の AWS の E2E はデプロイ後。CI に AWS の認証情報を置かずに済む

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-23T05:36:00Z — PR の有無（P1）、スケルトン確認コマンド（P4）、test-after か TDD か（P5）、自動デプロイの有無（P9）、リポジトリ構成（P11）はインタビューで決める
- 2026-11-23T05:55:35Z — `npm run verify` / `npm run smoke` の中身と、dev での実 AWS 試験の実行手順は Construction の最初の Unit で決める
