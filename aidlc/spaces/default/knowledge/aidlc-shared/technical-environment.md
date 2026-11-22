# Technical Environment — MonsterNote（タスク管理 Web アプリ）

> AI-DLC の全ステージが参照する技術環境ドキュメント。
> 最重要方針: **AWS 無料枠内でほぼ 0 円で動く、数人利用のデモ用 MVP**。

## Project Technical Summary

| 項目 | 内容 |
|---|---|
| Project name | MonsterNote（GitHub: masahirosako1005/MonsterNote） |
| Project type | Greenfield / デモ・学習用（AI-DLC2 の教材サンプル） |
| Runtime environment | ブラウザ（PC・スマートフォン）＋ AWS サーバレス |
| Cloud provider | AWS（既存の個人検証アカウント。別プロジェクト mononoke と共用） |
| Region | `ap-northeast-1`（東京）。AWS Budgets のみ `us-east-1` |
| Deployment model | フルサーバレス。常時起動のサーバを持たない |
| Users | 数人（同時利用 1〜5 人程度）。一般公開はしない想定 |
| Team | 開発者 1 人＋ AI エージェント |
| Delivery target | MVP。小さく作って AWS にデプロイし、動くところまで |

## Cost Policy（最優先）

- 目標は **AWS 無料枠内での運用（月額ほぼ 0 円）**。設計判断で迷ったら安い方を選ぶ。
- 有料が前提のサービス・常時課金のリソース（下記 Disallowed services）は使わない。
- 共用アカウントには月 $10 の AWS Budgets アラートが既にある（mononoke で作成済み）。新規作成は不要だが、コスト増が見込まれる設計は事前に人間へ確認する。
- 公開エンドポイントは国内外からの無作為アクセスを前提にし、スロットリング等で課金暴走を防ぐ。

## Programming Languages

### Required
- TypeScript 5.x（フロントエンド・バックエンド・IaC で統一）

### Prohibited
| 禁止 | 理由 | 代わりに |
|---|---|---|
| Java / .NET の Lambda ランタイム | コールドスタートとメモリ消費が大きく無料枠を早く使う | Node.js ランタイム |

## Frameworks and Libraries

### Preferred（Inception で確定する）
- IaC: AWS CDK（TypeScript）を第一候補。参考構成の mononoke は Serverless Framework v3 だった
- フロントエンド: React 系 SPA（静的書き出しできるもの。例: Next.js static export / Vite + React）
- Lambda: Node.js 20.x 以降、AWS SDK v3

### Getting a new library approved
- 有料ライセンスや外部 SaaS 契約が必要なものは人間の承認が必要。

## Cloud Environment

- Provider: AWS ／ Account: 既存の個人検証アカウント（AWS CLI の `default` プロファイル）／ Region: `ap-northeast-1`

### Allowed services（無料枠で収まる範囲で使う）
| サービス | 用途 | 無料枠の目安 |
|---|---|---|
| AWS Lambda | API 処理 | 月 100 万リクエスト / 40 万 GB 秒（常時無料） |
| Amazon API Gateway（HTTP API または REST） | API 公開 | 12 か月無料枠あり。スロットリング必須 |
| Amazon DynamoDB（オンデマンド or 小さなプロビジョンド） | データ保存 | 25 GB（常時無料） |
| Amazon Cognito User Pools | ログイン | 小規模 MAU は無料 |
| Amazon S3 | フロントエンド配信元・ファイル | 12 か月無料枠 5 GB |
| Amazon CloudFront | フロントエンド配信 | 月 1 TB 転送（常時無料） |
| AWS Amplify Hosting | フロントエンド配信（CloudFront の代替） | 12 か月無料枠あり |
| Amazon CloudWatch（Logs / 基本メトリクス / 少数のアラーム） | 監視 | 基本は無料枠内 |
| AWS Budgets | コスト監視 | 2 個まで無料 |

### Disallowed services
| 禁止 | 理由 | 代わりに |
|---|---|---|
| EC2 / ECS on EC2 / Fargate / App Runner | 常時課金 | Lambda |
| RDS / Aurora（Serverless v2 含む） | 時間課金・最小容量課金 | DynamoDB |
| NAT Gateway / Lambda の VPC 配置 | NAT Gateway は時間課金 | VPC 外の Lambda |
| ElastiCache / OpenSearch / MSK | 時間課金 | DynamoDB |
| AWS WAF | 月額固定費 | API Gateway スロットリング |
| Route 53 ホストゾーン・独自ドメイン | 月額費用 | CloudFront / Amplify の既定ドメイン |
| KMS カスタマーマネージドキー | 月額費用 | AWS マネージドキー |
| 有料 AI サービス（Bedrock 等）を常時呼ぶ機能 | 従量課金 | MVP では使わない |

### Getting a new service approved
- 上記にないサービスは、無料枠と想定月額を示して人間の承認を得る。

## Architecture and Patterns

- 構成: 静的 SPA（S3 + CloudFront または Amplify Hosting）→ API Gateway → Lambda → DynamoDB、認証は Cognito
- 参考: 同一アカウントの mononoke（Next.js 静的書き出し + Amplify Hosting / API Gateway + Lambda + DynamoDB + S3 + Cognito）
- API: REST、JSON。全エンドポイントに Cognito 認可を付ける（例外は理由をコメントに残す）
- Data: DynamoDB。利用者ごとにデータを分離する（他人のタスクを読めない・書けない）

## Security

### Sign-in and access
- Cognito User Pools。利用者は数人なので管理者が招待する方式でよい（セルフサインアップは任意）
- IAM は最小権限。Lambda ごとに必要なテーブル・操作だけを許可する

### Secrets
- 秘密情報（AWS 認証情報、`.env*`、パスワード）はリポジトリ・ドキュメント・ログに出さない。このリポジトリは **GitHub で公開**される
- 認証情報は利用者自身が `aws configure` で設定する

### Choose a security framework
- OWASP Top 10

## Testing

| 種類 | 方針 |
|---|---|
| Unit | Vitest などで主要ロジックをテスト |
| Integration | ローカルまたは dev 環境で API を確認 |
| End-to-end | 主要シナリオを手動または Playwright で確認 |
| Performance | **大量負荷試験はしない**（無料枠を超える）。数十リクエスト程度の確認に留める |

### Pipeline gates
- GitHub Actions（パブリックリポジトリは無料）で lint・型チェック・ユニットテスト
- AWS への自動デプロイを入れる場合は OIDC 連携（長期アクセスキーを GitHub に置かない）
