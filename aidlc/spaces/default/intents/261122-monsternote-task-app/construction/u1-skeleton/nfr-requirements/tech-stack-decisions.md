# Tech Stack Decisions（技術の選択）— U1 `u1-skeleton`（U2〜U4 も同じ）

入力: nfr-requirements-questions.md（Q1〜Q7）、`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`、`inception/practices-discovery/team-practices.md`（TypeScript、TDD、Vitest・Playwright、ESLint・Prettier、npm workspaces、CDK）、`inception/refined-mockups/design-system-mapping.md`（React ＋ MUI）、`inception/requirements-analysis/requirements.md`（NFR1・NFR12・NFR13）、project.md。

| 分野 | 選んだもの | 理由 | 選ばなかったもの | 出典 |
|---|---|---|---|---|
| 言語 | TypeScript 5.x（strict） | 画面・関数・AWS の構成を 1 つの言語にそろえる | — | team-practices |
| 関数の実行環境 | AWS Lambda、Node.js 22、Arm（Graviton）、128 MB（重い処理は 256 MB） | Arm は x86 より約 20% 安い。メモリは project.md の上限内 | x86、256 MB 固定（Q1 の B） | Q1、NFR12.2 |
| API の入口 | API Gateway HTTP API ＋ Cognito の証明の確認（JWT オーソライザー） | REST API より安く、証明の確認が組み込み。道ごとの流量の制限 | REST API（Q4 の B） | Q4 |
| データベース | DynamoDB、部品ごとの表、オンデマンド、既定の暗号化 | 持ち主の部品だけが読み書きする（Domain Design）。常時課金がない | 1 つの表（Q2 の B）、RDS（常時課金で禁止） | Q2、project.md |
| ログイン | Amazon Cognito ユーザープール（管理者が作成、グループで役割） | 証明の発行・出し直し・パスワードの規則を持つ。無料の範囲 | 自作（Q3 の B） | Q3 |
| 写真の保存場所 | S3（公開しない、期限付きの URL、既定の暗号化） | 直接アップロードで API の容量にかからない | — | contract-summary Q2 |
| 画面 | React 18 ＋ MUI（Material UI）＋ Vite、S3 ＋ CloudFront（OAC）、ハンター用と依頼元用で別々の CloudFront | Refined Mockups の決定。静的なファイルなので常時課金がない | 1 つの CloudFront で道を分ける（Q5 の B） | Q5、design-system-mapping |
| 部品の間の知らせ | NFR Design で決める（EventBridge などの候補を、確実に届ける方法と合わせて選ぶ） | ADR-008 | — | ADR-008 |
| AWS の構成 | AWS CDK（TypeScript）、1 つの CDK アプリ、`ap-northeast-1`、default のプロファイル | Units Generation の決定 | — | team-practices、Q3（Units） |
| 監視 | CloudWatch Logs（14 日）・標準のメトリクス・アラーム 2 つ・SNS のメール | 無料枠の中 | X-Ray（Q6 の B） | Q6 |
| テスト | Vitest（単体・結合）、DynamoDB Local（手元の結合）、aws-cdk-lib/assertions（構成）、Playwright ＋ axe（E2E・アクセシビリティ） | team-practices の決定 | — | team-practices |
| コードの品質 | ESLint（typescript-eslint）、Prettier、行カバレッジ 80% 以上（画面と API のロジック） | team-practices の決定 | — | team-practices、NFR13 |
| リポジトリの構成 | npm workspaces（`frontend` / `backend` / `infra`）。細かい構成は Code Generation で決める | Units Generation・team-practices | — | team-practices |

## 品質の要件（NFR13）

| ID | 要件 | 出典 |
|---|---|---|
| NFR13.1 | 画面と API のロジックの行カバレッジ 80% 以上（Vitest のカバレッジ）。CDK のコードは対象外とし、構成の試験を書く | NFR13、team-practices |
| NFR13.2 | テストは先に書く（TDD、Red → Green → Refactor） | NFR13、team-practices |
| NFR13.3 | push と PR のたびに GitHub Actions で lint・型チェック・テスト・AWS なしの E2E を動かし、失敗した PR は取り込まない。CI は AWS に接続しない | NFR13、team-practices |
| NFR13.4 | 各 Unit の完成の確認は `npm run verify`（Delivery Planning で承認されたコマンド） | Delivery Planning |

## Assumptions & Open Questions

- ライブラリの細かい版（React 18 系、MUI 6 系など）は Code Generation のときに、その時点の安定版から選ぶ。 [assumption]
