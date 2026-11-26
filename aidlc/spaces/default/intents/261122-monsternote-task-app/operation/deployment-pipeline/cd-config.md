# CD Config — Deployment Pipeline

## 1. この文書の位置づけ

このステージ（deployment-pipeline）は本来、`ci-pipeline`ステージが作る`ci-config`・`quality-gates`を読み込んで、その先のCD（継続的デプロイ）部分を設計するステージである。しかし本プロジェクトでは`ci-pipeline`ステージ自体をCONDITIONALの既定条件（「既存のCIが整っていれば実行しない」）に基づいて明示的にスキップしている — `.github/workflows/ci.yml`がすでに`npm run verify`と同等の検査（format・lint・typecheck・test:coverage・test:e2e・synth）を push／PR のたびに実行しているため。

したがってここでは、本ステージのStep 1が指示するとおり（「On brownfield, inspect the workspace's existing pipeline ... Design only against evidence that exists」）、`.github/workflows/ci.yml`そのものを事実上の`ci-config`として直接検査し、team.md・project.mdにすでに記録済みのデプロイ方針をCDパイプラインの構成として文書化する。新しい自動化を提案するステージではなく、**すでに決まっている「手動デプロイ」という方針を正式な成果物として書き起こす**ことが本ステージの役割である。

## 2. 現在のCI（検査のみ。デプロイなし）

ファイル: `.github/workflows/ci.yml`

| 項目 | 内容 |
|---|---|
| トリガー | `push`・`pull_request`（すべてのブランチ） |
| 実行環境 | `ubuntu-latest`、Node.js 22、Java 17（DynamoDB Local用） |
| 検査の内容 | `format:check`（Prettier）→`lint`（ESLint）→`typecheck`→`test:coverage`（Vitest、カバレッジ80%の床）→Playwrightブラウザのインストール→`test:e2e`（AWSなし、APIはモック）→`synth`（`cdk synth`。デプロイしない） |
| AWSへの接続 | なし。`permissions: contents: read`のみで、AWSの認証情報はワークフローに一切渡していない |
| 失敗時 | どれか1つでも失敗すればジョブ全体が失敗する（`timeout-minutes: 30`）。失敗したPRは取り込まない（team.mdの決まり） |

**この構成には、デプロイを行うステップが1つも無い。** これは見落としではなく、team.mdに明記された意図的な決定である:「最初の版では、GitHub Actionsからの自動デプロイは入れない。CIは検査だけを行い、AWSの認証情報をGitHubに置かない」。

## 3. CD（継続的デプロイ）の構成 — 「構成なし」が構成

| 項目 | 内容 |
|---|---|
| 自動デプロイの有無 | **無し**。GitHub Actionsはビルド・テスト・`synth`の確認までで止まる |
| デプロイの実行者 | 人（開発者本人）。自分のパソコンから手で実行する |
| デプロイのコマンド | `cdk deploy`（`infra`ワークスペース） |
| 認証情報 | AWS CLI の `default` プロファイル（開発者のパソコンに設定済み）。GitHubやCIには一切置かない |
| リージョン | `ap-northeast-1` |
| 対象環境 | `dev`の1つのみ（§4参照） |
| 実行前の必須確認 | **人への確認を毎回行う**（project.md Mandated:「ALWAYS ask the human before running any deploy or destroy against AWS」）。コストの見積もりも、新しいリソースを作る前に示す |
| デプロイ後の確認 | `npm run smoke`（`scripts/smoke.ts`）が通るまでデプロイ完了とみなさない（`deployment-strategy.md`参照） |

この「構成が無いことが構成である」という形は、CD設定ファイル（GitHub Actions のデプロイジョブ、CodePipeline、Argo CD等）を一切持たない。デプロイの手順はすべて`rollback-runbook.md`・`deployment-strategy.md`に人が読む手順として記述する。

## 4. 環境promotionの構成

| 環境 | 用途 | 昇格ゲート |
|---|---|---|
| （ローカル） | 開発・単体／結合試験 | `npm run verify`が通ること |
| `dev` | 開発確認・少人数の試験運用の両方を兼ねる唯一のAWS環境 | デプロイ前の人の承認＋デプロイ後の`npm run smoke` |

`staging`・`production`は存在しない。project.mdの制約（AWS無料枠・共用アカウント・1人運用）のもとでは、環境を増やすこと自体が費用・運用負荷の増加であり、この規模（少人数の試験運用）には見合わないという判断（team.md Deployment節）。

## 5. feature flag戦略

採用しない。CloudWatch Evidently・AppConfig等のフィーチャーフラグ基盤は、今回の規模（単一`dev`環境、段階的なロールアウトを必要とする利用者層が無い）では導入する理由が無く、無料枠を圧迫するリスクのほうが大きい。機能の出し分けが必要になった場合は、Unit単位のデプロイ（1回のデプロイで1つの完結した変更を出す）で足りると判断する。

## 6. 承認ワークフロー（本番相当）

`production`環境自体が存在しないため、「本番への昇格承認」という工程も存在しない。唯一の環境`dev`へのデプロイが、事実上もっとも重い変更であり、その承認は前述のとおり**人へのその都度の確認**という形で行われる（CI/CD基盤上の承認ステップではなく、会話上の確認）。

## 7. 将来の自動化（今回は作らない。方向性のメモ）

自動デプロイを将来追加する場合の推奨経路（team.md既載の方針をここに正式に記録する）:

- **OIDC**（OpenID Connect）でGitHub ActionsからAWSへ一時的な認証情報を取得する構成とし、長期のアクセスキーをGitHub Secretsに置かない。
- **GitHub Environments**の手動承認（Required reviewers）を`dev`へのデプロイジョブに設定し、人の承認を自動化の中に残す。
- 導入のタイミングは、プロジェクトの利用者が増え、手動デプロイの頻度・手間がボトルネックになった時点を目安とする。現時点（無料枠・1人運用・少人数の試験運用）では導入しない。

この節は提案であり、本ステージの成果物としての決定事項ではない。
