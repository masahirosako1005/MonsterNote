# Environment Inventory — Environment Provisioning

## 1. この文書の性質 — 「設計上の」在庫であり「実機の」在庫ではない

この文書は `infra/lib/*.ts`（CDKのソースコード、2026-11-26時点）を読み、そこに**宣言されている**リソースを一覧にしたものである。**AWSの実アカウントに実際に存在するリソースを問い合わせて作った一覧ではない**（本ステージの実行時点でAWS認証情報へのアクセスが無いため）。設計と実機の差分は`validation-report.md`で扱う。

唯一の環境: **`dev`**（`ap-northeast-1`、アカウント`611913894230`。project.mdの共用アカウント、mononokeと共存）。

## 2. スタック構成（5スタック）

| スタック | 役割 | 相互依存 |
|---|---|---|
| `MonsterNote-Auth-dev` | Cognitoユーザープール・アプリクライアント・グループ | 無し（起点） |
| `MonsterNote-Web-dev` | 画面用S3×2・CloudFront×2 | 無し（起点） |
| `MonsterNote-Data-dev` | DynamoDBテーブル×14・写真用S3×1 | Webスタックの`webOrigins`（S3のCORS許可元）を受け取る |
| `MonsterNote-Api-dev` | HTTP API・Lambda関数×12・EventBridge・アラーム | Auth・Dataの両方に依存 |
| `MonsterNote-WebContent-dev` | 画面ビルドのS3配置＋`config.json`の注入 | Web・Apiに依存（APIのURL等を`config.json`に書く） |

## 3. Authスタック（`auth-stack.ts`）

| リソース | 内容 |
|---|---|
| Cognitoユーザープール | セルフサインアップ無効（管理者のみ作成）。パスワード方針: 8文字以上・小文字＋数字必須。`AccountRecovery.NONE`。`RemovalPolicy.RETAIN` |
| アプリクライアント | シークレット無し。`userPassword`＋`userSrp`認証。アクセス/IDトークン1時間、リフレッシュトークン30日（rotation有効、猶予60秒） |
| ユーザープールグループ | `hunter`・`requester`・`admin`の3グループ |

## 4. Webスタック（`web-stack.ts`）

| リソース | 内容 |
|---|---|
| S3バケット×2（hunter・requester） | `BLOCK_ALL`公開禁止・S3管理の暗号化・SSL強制・`RETAIN` |
| CloudFrontディストリビューション×2 | OAC経由でS3を参照。`PriceClass.PRICE_CLASS_200`。CSPを含むセキュリティヘッダー（HSTS・X-Frame-Options: DENY等）。SPA向けに403/404を`index.html`へ200で返す。`/index.html`・`/config.json`はキャッシュ無効 |

## 5. Dataスタック（`data-stack.ts`）

**DynamoDBテーブル: 14個**（すべて`PAY_PER_REQUEST`・`RemovalPolicy.RETAIN`）

| テーブル | パーティションキー | GSI | 追加されたUnit |
|---|---|---|---|
| Accounts | accountId | loginId、gsiAll | U1／U4で拡張 |
| Photos | photoId | — | U1 |
| Reports | reportId | — | U1 |
| SubmissionKeys | submissionKey | — | U1 |
| ReviewDecisions | reportId | — | U1 |
| ReportListItems | reportId | gsiAll、gsiHunter | U1 |
| ProcessedEvents | consumerEventId（TTL） | — | U1 |
| DetectionResults | photoId（TTL） | — | U2 |
| ReportFootprints | reportId | speciesDay | U2 |
| DuplicateSuspicions | suspicionId | byReportId | U2 |
| Settings | settingKey | — | U2 |
| DetectionRateLimits | accountIdDate（TTL） | — | U2 |
| AdminCounter | counterKey | — | U4 |
| AuditEntries | entryId | gsiAll | U4 |

**S3: 写真用バケット×1**（Dataスタック。`BLOCK_ALL`・SSL強制・`RETAIN`。CORSはWebスタックの2オリジンにPOST/GETを許可。ライフサイクルルール: 作成1日で自動削除）

## 6. Apiスタック（`api-stack.ts`）

**Lambda関数: 12個**（すべて`NODEJS_22_X`・`ARM_64`・メモリ128〜256MB・CloudWatch Logs保存14日・`DESTROY`）

| 関数 | メモリ | タイムアウト | 役割 |
|---|---|---|---|
| Accounts | 128MB | 8秒 | ログイン・アカウント管理・初回手続き |
| AuditLog | 128MB | 10秒 | 操作記録の受信・一覧（U4） |
| Settings | 128MB | 8秒 | 設定の読み書き |
| DuplicateDetection | 256MB | 15秒 | 重複判定 |
| Reporting | 256MB | 15秒 | 報告の送信・写真受付 |
| Review | 128MB | 15秒 | 承認・却下 |
| Catalog | 128MB | 15秒 | 一覧・削除 |
| ReviewOnSaved | 128MB | 10秒 | イベント受信（report.saved） |
| CatalogOnSaved | 128MB | 10秒 | イベント受信（report.saved） |
| CatalogOnStatus | 128MB | 10秒 | イベント受信（review.status-changed／duplicate.suspected） |
| DuplicateDetectionOnSaved | 256MB | 10秒 | イベント受信（report.saved） |
| DuplicateDetectionOnStatus | 128MB | 10秒 | イベント受信（review.status-changed） |

**HTTP API**: ルート30個（CORS設定・スロットリング rateLimit 10／burstLimit 20・Cognitoの JWT オーソライザー。ログインと証明の出し直しのみ認証無し）。

**EventBridge**: カスタムバス`monsternote-dev`×1、ルール4個（ReportSavedRule・StatusChangedRule・DuplicateSuspectedRule・AuditRecordedRule）。

**監視**: CloudWatchアラーム3個（API 5xx率×1、Lambda全体のエラー合計×2。CloudWatchの「1アラームにつき指標は合計10個まで」の上限のため、関数を9個以下ずつの組に分けて別アラームにしている。12関数を2組〈9個＋3個〉に分割。deployment-executionでの実機デプロイ時に、1個にまとめる設計〈入れ子の数式で回避を試みていたが実際には平らに展開され上限を超えた〉がデプロイ失敗の原因と判明し、修正した）、SNSトピック1個（`masahiro-sns-monsternote-alarm`）。

## 7. WebContentスタック（`web-content-stack.ts`）

`BucketDeployment`×2（hunter・requester）。画面ビルドの成果物と`config.json`（実行時設定: `apiBaseUrl`・`userPoolId`・`userPoolClientId`・`photoBucketUrl`）を配置し、CloudFrontのキャッシュを無効化する。メモリ128MB、ログ保存14日。

## 8. タグ付け・命名規約の確認

project.mdのMandated「`Name=masahiro-<aws-service>-monsternote`」について、SNSトピック名・アラーム名（`masahiro-sns-monsternote-alarm`、`masahiro-cloudwatch-monsternote-*`）は命名そのものに規約が反映されている。他のリソース（Lambda・DynamoDB・S3・CloudFront等）は個別の`Tags.of(...).add(...)`呼び出しではなく、`infra/lib/tagging-aspect.ts`の`NameTagAspect`（`CfnResource`を持つすべてのリソースを巡回し`Name`・`Project`タグを付与するCDK Aspect。`infra/lib/monsternote.ts`で`Aspects.of(app).add(new NameTagAspect())`として全スタック共通で適用）によってタグ付けされている。最初の確認ではこのAspect方式を見落とし「タグ付けが見当たらない」と誤って記載していたが、訂正済み。実際に`cdk synth`した`MonsterNote-Data-dev`テンプレートで`AccountsTable`に`Name=masahiro-dynamodb-monsternote`・`Project=monsternote`が付くことを確認した。詳細は`validation-report.md` §4。

## 9. 常時課金リソースの有無

CDKソース上、EC2・RDS/Aurora・NAT Gateway・Fargate・ElastiCache・WAF・Route 53ホストゾーンへの参照は無い。すべてサーバーレス（Lambda・DynamoDB PAY_PER_REQUEST・S3・CloudFront・API Gateway HTTP API・Cognito・EventBridge・CloudWatch・SNS）。project.mdのForbidden「NEVER use always-on or hourly-billed AWS resources」に抵触する設計は無いと判断する（設計レベルの確認。実機での課金実績はvalidation-report.mdで別途扱う）。
