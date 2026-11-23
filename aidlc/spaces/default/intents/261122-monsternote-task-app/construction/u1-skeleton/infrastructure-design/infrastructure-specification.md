# Infrastructure Specification（AWS の構成）— U1 `u1-skeleton`

入力: `construction/u1-skeleton/nfr-design/`（logical-components L1〜L9、security・reliability・performance・scalability・observability の設計）、`construction/u1-skeleton/functional-design/functional-spec.md`（functional-spec。U1 の流れ UC1〜UC7）、`inception/domain-design/components.md`（components。部品ごとの表と関数の分け方）、`construction/u1-skeleton/nfr-requirements/tech-stack-decisions.md`、`inception/contract-design/contract-summary.md`、`inception/practices-discovery/team-practices.md`、infrastructure-design-questions.md（Q1〜Q5）、project.md。

## 1. Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | サーバーレス（Lambda: Node.js 22・Arm・esbuild でまとめる） | 常時課金なし（project.md）、tech-stack |
| Networking | VPC を使わない。入口は CloudFront（画面）と HTTP API（API）だけ。部品の間は Lambda の直接の呼び出し（IAM） | NAT Gateway などの常時課金を避ける。security-design NFR4.4 |
| Storage | DynamoDB（部品ごとの表・オンデマンド）、S3（写真 1 つ・画面 2 つ） | NFR Design |
| Environments | dev の 1 つ（`ap-northeast-1`、AWS CLI の default のプロファイル） | team-practices |
| IaC | AWS CDK（TypeScript）、1 つの CDK アプリに 4 つのスタック（下の表） | Q2 |
| Resource sizing | 関数 128 MB（Reporting は 256 MB）、時間切れ: API の関数 8 秒・知らせの受け手 10 秒。HTTP API の流量: 毎秒 10・瞬間 20 | NFR12、reliability-design |
| Tagging | CDK の Aspect（全リソースを巡る仕組み）で、リソースの種類ごとに `Name=masahiro-<aws-service>-monsternote` を付ける（例: Lambda の関数は `masahiro-lambda-monsternote`、DynamoDB の表は `masahiro-dynamodb-monsternote`、S3 は `masahiro-s3-monsternote`）。全リソースに `Project=monsternote` も付ける。構成の試験で、タグの付けられるリソースすべてに Name があることを確かめる | NFR1.2、project.md、レビューの指摘 |
| CDK の bootstrap | 共用アカウント（mononoke と同じ）の既定の bootstrap（`CDKToolkit`）に触れないよう、MonsterNote 専用の qualifier（`mnote`）とスタック名（`MonsterNote-CDKToolkit`）で bootstrap する。作る前に人の承認を取る | project.md（mononoke に触れない、デプロイ前の確認）、レビューの指摘 |

### スタック（Q2。レビューの Critical を受けて、依存が一方向になるよう 5 つに分けた）

| 順 | スタック | 中身 | 依存するスタック | 消したときの扱い |
|---|---|---|---|---|
| 1 | `MonsterNote-Auth-dev` | Cognito のユーザープール、アプリのクライアント、グループ（hunter・requester・admin） | なし | ユーザープールは RETAIN |
| 2 | `MonsterNote-Web-dev` | 画面の S3 ×2、CloudFront ×2（OAC、レスポンスヘッダーのポリシー）。画面のファイルは置かない | なし | 作り直してよい |
| 3 | `MonsterNote-Data-dev` | DynamoDB の表 7 つ、写真の S3（CORS に Web の 2 つの CloudFront の URL） | Web | すべて RETAIN |
| 4 | `MonsterNote-Api-dev` | HTTP API（CORS に Web の 2 つの URL）、JWT オーソライザー（Auth）、関数 7 つ（Data の表と写真の S3）、EventBridge、アラーム、SNS | Auth・Web・Data | 作り直してよい |
| 5 | `MonsterNote-WebContent-dev` | 画面のビルドを 2 つの画面の S3 に置く（BucketDeployment）、実行時の設定ファイル `config.json`（API の URL、ユーザープールの ID、クライアントの ID、写真の S3 の URL）を一緒に置く、CloudFront のキャッシュの無効化 | Auth・Web・Data・Api | 作り直してよい |

**依存の向き**: Auth → Web → Data → Api → WebContent の一方向。輪はない。
- 画面のビルドに API の URL などを埋め込まない。画面は起動のときに `config.json` を読む（実行時の設定）。そのため、Web（CloudFront）は API より先に作れる。
- CloudFront の CSP（Web）は、API と写真の S3 の具体の URL を使わず、地域の範囲で指定する: `connect-src 'self' https://*.execute-api.ap-northeast-1.amazonaws.com https://cognito-idp.ap-northeast-1.amazonaws.com https://*.s3.ap-northeast-1.amazonaws.com`、`img-src 'self' blob: data: https://*.s3.ap-northeast-1.amazonaws.com`。security-design の CSP（具体の URL）をこの形に読み替える（範囲が少し広くなるが、自分のスクリプトだけを動かす `script-src 'self'` は変わらない）。
- 写真の S3 の CORS は POST と GET を許す（Q1）。security-design の「PUT と GET」は、Q1 によりこの表のとおり読み替える。
- 物理的な名前（表やバケットの名前）は固定せず CDK に作らせる。関数には環境変数で渡す。

## 2. Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Cognito ユーザープール | 認証 | 自分での登録なし、パスワード 8 文字以上（小文字・数字）、ID・アクセストークン 1 時間、リフレッシュトークン 30 日、**リフレッシュトークンの更新（rotation）有効・再利用の猶予 60 秒**、USER_PASSWORD_AUTH・REFRESH_TOKEN_AUTH を許す、秘密の値なしのクライアント | Q4、security-design |
| DynamoDB `Accounts` | データ | キー accountId。索引: loginId | Accounts の関数だけ |
| DynamoDB `Reports` | データ | キー reportId。属性 eventSent | Reporting の関数だけ |
| DynamoDB `SubmissionKeys` | データ | キー submissionKey（状態・期限・reportId） | Reporting の関数だけ。送信のキーの状態の表（reliability-design） |
| DynamoDB `Photos` | データ | キー photoId | Reporting の関数だけ |
| DynamoDB `ReviewDecisions` | データ | キー reportId。属性 eventSent | Review の関数だけ |
| DynamoDB `ReportListItems` | データ | キー reportId。索引 ①全件（固定のパーティション＋ submittedAt#reportId）②ハンター（hunterAccountId ＋ submittedAt#reportId） | ReportCatalog の関数だけ。一覧は索引の 1 回のクエリ（BR4.4） |
| DynamoDB `ProcessedEvents` | データ | キー consumer#eventId、TTL 7 日 | 知らせの受け手の 2 回目の無視（NFR10.4）。TTL で自動で消える（無料） |
| S3 写真 | 保存場所 | パブリックアクセスのブロック、SSE-S3、CORS（POST・GET、2 つの CloudFront の Origin）、署名付きの POST の条件（キー・内容の種類・content-length-range 1〜15 MB・5 分） | Q1。結び付かない写真の 24 時間の削除は U2 |
| S3 画面 ×2 | 画面のファイル | パブリックアクセスのブロック、OAC で CloudFront からだけ | — |
| CloudFront ×2 | CDN | HTTP を HTTPS に転送、既定のドメイン、圧縮、キャッシュ（ハッシュ付きのファイルは長く、index.html はキャッシュしない）、SPA のための 403/404 → index.html、レスポンスヘッダーのポリシー（CSP・HSTS など） | 価格クラスは 200（アジアを含む） |
| API Gateway HTTP API | 入口 | JWT オーソライザー（`POST /v1/session`・`POST /v1/session/refresh` 以外）、CORS（2 つの Origin）、既定のステージの流量 10/20、アクセスログ（14 日） | — |
| Lambda | 処理 | accounts・reporting・review・catalog（API）、review-on-saved・catalog-on-saved・catalog-on-status（知らせ）。それぞれ自分の表だけの IAM の権限、ロググループ 14 日 | 部品ごとに分けた関数 |
| EventBridge | 知らせ | 独自のバス `monsternote-dev`。ルール: report.saved → review-on-saved・catalog-on-saved、review.status-changed → catalog-on-status。送り手（source）で絞る | Q1（NFR Design）。DLQ なし |
| CloudWatch ／ SNS | 監視 | アラーム 2 つ（monitoring-design）、SNS のトピック（メール購読） | Q5 |

## 3. Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Cognito ユーザープール | U1 | U2〜U4 | 各関数は JWT の検証だけ。ユーザーの作成は Accounts（U1 はスクリプト、U4 は画面） |
| HTTP API | U1 | U2〜U4 | 各 Unit が自分の部品の道と関数を足す |
| EventBridge のバス | U1 | U2〜U4 | 各部品は自分の source で送り、自分のルールで受ける |
| `MonsterNote-Data-dev` | U1 | U2〜U4 | 表は部品ごと。U2〜U4 は自分の表を足す |

## 4. 新しいリソースの費用の見込み（project.md の Mandated）

| リソース | 無料枠 | 月額の見込み（試験運用の規模） |
|---|---|---|
| Lambda（7 関数） | 月 100 万回・40 万 GB 秒（常に無料） | 0 円 |
| HTTP API | 月 100 万回（12 か月） | 0 円 |
| DynamoDB（7 表、オンデマンド） | 25 GB（常に無料） | 0〜数円 |
| S3（3 バケット） | 5 GB（12 か月） | 0 円 |
| CloudFront（2） | 月 1 TB・1,000 万リクエスト（常に無料） | 0 円 |
| Cognito | 月 1 万人程度まで無料の範囲（利用者 20 人） | 0 円 |
| EventBridge（独自の知らせ） | なし（100 万件で約 1 ドル） | 1 円未満 |
| CloudWatch（ログ 14 日・アラーム 2）・SNS | ログ 5 GB、アラーム 10、メール 1,000 通 | 0 円 |
| CDK の bootstrap（`MonsterNote-CDKToolkit`: S3 バケット 1、ECR リポジトリ 1、IAM ロール、SSM パラメーター） | S3 5 GB（12 か月）、ECR 500 MB（12 か月）、IAM・SSM の標準のパラメーターは無料 | 0 円（デプロイのファイルは数 MB。ECR はコンテナを使わないため空） |
| **合計** | | **月 数円以内**（目標の月 100 円以内） |

金額は公開の料金表からの見込み（最新の料金はデプロイの前に確かめる）。

## 5. 約束（contract-summary）の変更

| 約束 | 変更 | 種類 |
|---|---|---|
| C2 `POST /v1/photos` の応答 | `uploadUrl` に加えて `uploadFields`（署名付きの POST の項目）を返す | 足すだけの変更（Q1） |
| C2 の source | `device` を足す（Functional Design） | 足すだけの変更 |

Code Generation で、共通の約束の置き場の仕様に反映する。

## Assumptions & Open Questions

- 地図のサービス（requirements OQ-3）は U1 では使わない（U1 は地名なし）。U2 の Infrastructure Design で選ぶ。 [assumption]
