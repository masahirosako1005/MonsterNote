# Evidence — Practices Discovery（MonsterNote）

リード（aidlc-pipeline-deploy-agent）が 1 人で調べ、下書きを作り、人へのインタビュー（Q1〜Q16、まとめの確認は「Looks correct」）の結果で書き直した記録です。このスコープでは Collaborators が off のため、サポートエージェント（quality / developer / devsecops）の独立レビューとその寄稿ファイルはありません。

## 調べたもの

| 対象 | わかったこと |
|---|---|
| `aidlc-state.md` | Greenfield、スコープ `feature`、Depth Standard、Test Strategy Standard。Construction は unit-major・serial、チェックポイントあり |
| `.claude/scopes/aidlc-feature.md` | `skeleton: on`（最初に端から端まで動く細い版を作る） |
| `aidlc/spaces/default/memory/org.md` | 5 つの節（Way of Working、Walking Skeleton、Testing Posture、Deployment、Code Style）を下書きの**提案の既定値**として使った |
| `aidlc/spaces/default/memory/team.md` | すべての節が空。今回は初回（再実行ではない） |
| `aidlc/spaces/default/memory/project.md` | 東京リージョン・無料枠・タグ規則、Forbidden 4 件、Mandated 3 件（どれも 2026-11-23 確定済み） |
| `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` | TypeScript 統一、CDK 第一候補、Vitest、GitHub Actions（公開リポジトリは無料）、自動デプロイなら OIDC、負荷試験はしない。※製品名の説明が古い「タスク管理アプリ」のまま。いまの製品は害獣の捕獲報告アプリ |
| `ideation/feasibility/constraint-register.md` | 制約 20 件（費用は月 100 円以内、1 か月で最初の版、開発者 1 人＋AI など） |
| `ideation/approval-handoff/initiative-brief.md` | 作る順番は「ハンターが報告 → 依頼元が確認」を先に通す。Go 判断済み |
| git の履歴（`main`、統合時の HEAD `cc45083`） | コミットはセットアップと文書だけ。メッセージは `docs:` `chore:` の Conventional Commits の形。ブランチは `main` のみ |
| CI・リンターの設定 | `.github/`、`package.json`、ESLint・Prettier・tsconfig の設定は**まだ無い** |

## 推測したこと（下書きの根拠）

- **Way of Working**: 開発者 1 人のため、トランクベース・`main` へ squash（org.md の既定）が合うと考え、PR なしを提案した。→ 人は PR ありを選んだ（下記 Q1）。
- **Walking Skeleton**: スコープが `skeleton: on`。initiative-brief の「報告 → 確認を先に通す」をそのままスケルトンの範囲として提案した。→ 人が採用（Q15）。
- **Testing Posture**: 決めた方法がないため org.md の既定 test-after を提案した。→ 人は TDD を選んだ（Q5）。
- **Deployment**: org.md の「マージで staging に自動デプロイ」は project.md の「デプロイ前に必ず人に確認する」と合わないため、手元からの手動デプロイ（人の確認つき）と環境 1 つを提案した。→ 人が採用（Q8・Q9）。
- **Code Style**: 設定がまだ無いため、TypeScript の一般的な組み合わせ（ESLint＋Prettier）を提案した。言語は「識別子・コメントとも英語」を提案した。→ 人はコメントを日本語にした（Q12）。

## インタビューの決定

インタビュー（`practices-discovery-questions.md`）の答えが人の決定で、下書きの提案と違うところは人の答えを採った。

| 質問 | 答え | team-practices.md への反映 |
|---|---|---|
| Q1 取り込み方 | B: 毎回 PR を作り、GitHub の画面で確認してから取り込む | Way of Working |
| Q2 コミットのまとめ方 | 「1」（どの選択肢か判断できず）→ **Q14 で解決** | — |
| Q3 細い版を作るか | X: 「単体試験・結合試験の一部はローカル、結合・総合試験以降を AWS で行いたいが可能か」という質問 → **Q15 で回答し、選択も Q15 で解決** | — |
| Q4 動いたことの確認 | A: 手元で `npm run verify`、人の確認のあと `dev` にデプロイして `npm run smoke` | Walking Skeleton |
| Q5 テストの順番 | B: TDD（先にテスト） | Testing Posture（`Methodology: tdd`） |
| Q6 カバレッジの範囲 | A: アプリのロジック（画面・API）に 80%。CDK は対象外で、構成を確かめるテストを書く | Testing Posture |
| Q7 E2E を動かすとき | B: push のたびに CI で → Q8・Q9 と食い違うため **Q16 で解決** | — |
| Q8 AWS の環境の数 | A: `dev` の 1 つ | Deployment |
| Q9 デプロイの方法 | A: 人の確認のあと手元から `cdk deploy`。GitHub からの自動デプロイはしない | Deployment |
| Q10 版の印と戻し方 | A: デプロイのたびに git タグ、戻すときは 1 つ前のタグを再デプロイ | Deployment |
| Q11 リポジトリの分け方 | A: 1 リポジトリを `frontend` / `backend` / `infra` に分け、npm workspaces | Code Style |
| Q12 コードの言語 | B: 識別子は英語、コメントは日本語（画面は日本語） | Code Style |
| Q13 新しい決まり | A: 特にない | discovered-rules.md は両方 `None.` |
| Q14 まとめ方（Q2 の確認） | A: PR ごとに「Squash and merge」 | Way of Working |
| Q15 試験の場所と細い版（Q3 の確認） | A: 手元＝単体＋結合の一部（モック・DynamoDB Local）、AWS `dev`＝結合の残り＋総合。細い版を作る（ログイン → 写真 1 枚の報告 → 依頼元が承認） | Walking Skeleton、Testing Posture |
| Q16 E2E の場所（Q7 と Q8・Q9 の食い違い） | A: CI では AWS を使わずに E2E（API はモック）。本物の AWS の E2E は、人の確認のあと `dev` にデプロイしてから | Testing Posture、Deployment |
| まとめの確認 | Looks correct | 上のすべて |

### 食い違いとその解き方

- **Q2 の「1」**: 選択肢の記号ではなかったため、Q1（PR あり）に合わせて「PR の取り込み方」として Q14 で聞き直し、「Squash and merge」に決まった。org.md の既定（Bolt ごとに squash）とも合う。
- **Q3 の質問**: 選択の代わりに「試験の場所を分けられるか」という質問だった。Q15 で「可能」と答えて分け方を示し、細い版を作るかもあわせて選んでもらった。
- **Q7 と Q8・Q9**: 「E2E を push のたびに CI で」と「AWS は `dev` 1 つ・GitHub からの自動デプロイなし」は、CI から AWS を使う E2E を動かせない点で合わなかった。Q16 で「CI では AWS を使わない E2E、本物の AWS の E2E はデプロイ後」に決まり、CI に AWS の認証情報を置かずに済む。

### project.md との整合

- 「デプロイ・削除の前に必ず人に確認する」（Mandated）: デプロイは手元から人の確認つきのみ。CI は AWS に接続しない。
- 「秘密情報をコミットしない」（Forbidden）: CI に AWS の認証情報を置かない。PR の前後で差分を確かめる。
- 「無料枠を超える負荷試験をしない」（Forbidden）: 性能の確認は数十リクエスト程度にとどめる。
- 「Lambda のメモリ 128〜256 MB、ログ保存 14 日以内、API のスロットリング」（Mandated）とタグ規則: CDK の構成テストで確かめる。

## 残る不確かさ

- `npm run verify` と `npm run smoke` はまだ存在しない。中身（何を順に実行するか、スモークで叩く URL や健康確認の API）は Construction の最初の Unit で作り、人が確認コマンドとして承認する。
- 本物の AWS を使う結合試験・総合試験・E2E を `dev` で動かす手順（誰が、どのコマンドで）は、スモークと同じく手元から人の確認のあとに実行する前提。具体的なコマンドは Construction で決める。
- `dev` 1 つを開発と試験運用の両方に使うため、試験運用中の利用者のデータとテストのデータが同じ環境に入る。テストのデータの分け方や後片付けは、Functional Design / Infrastructure Design で扱う。
- E2E で API を置き換えるモックの作り方（MSW などの道具）は Construction で決める。
- 技術環境の文書が製品を「タスク管理アプリ」と書いている点は古い記述で、この段階の判断には影響しない。直すかどうかは人に任せる。
- フロントエンドの配信を S3 + CloudFront にするか Amplify Hosting にするかは、Infrastructure Design で決める（この段階の範囲外）。
