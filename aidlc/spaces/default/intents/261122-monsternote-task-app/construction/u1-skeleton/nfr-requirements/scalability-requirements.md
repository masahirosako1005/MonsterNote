# Scalability Requirements（規模・費用・運用の制約）— U1 `u1-skeleton`

入力: `inception/requirements-analysis/requirements.md`（NFR1・NFR3・NFR12）、`ideation/feasibility/constraint-register.md`（C-C1〜C-C4、C-T2・C-T3）、`inception/delivery-planning/bolt-plan.md`（費用の確認）、nfr-requirements-questions.md（Q1・Q2・Q4）、project.md。

## 1. 規模

| ID | 要件 | 出典 |
|---|---|---|
| NFR3.1 | 試験運用の規模: 利用者 20 人以下、同時の利用者 10 人以下、報告は月 50 件未満、写真は月 150 枚程度。この規模で NFR2 の応答時間を守る | NFR3、raid-log A1 |
| NFR3.2 | どの部品も、利用者や報告が増えたときに設定を変えずに動く（サーバーの台数を決めないサーバーレスの部品だけを使う） | NFR3、Q1・Q2・Q4 |

## 2. 費用

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR1.1 | U1 が使う AWS のサービスは、試験運用の規模で無料枠に収まる（下の見積もり）。MonsterNote の全体で月 100 円以内 | 下の表と、Bolt 1 の完了時のタグ別の費用の確認 | NFR1、C-C1 |
| NFR1.2 | すべてのリソースに `Name=masahiro-<aws-service>-monsternote` のタグを付け、請求コンソールのタグ別の表示で費用を確かめる | CDK の構成の試験（タグ）、各 Bolt の完了時の確認 | NFR1、NFR12、C-C2 |
| NFR1.3 | 新しい AWS のリソースは、作る前に無料枠に収まるかと月額の見込みを示す（project.md） | Infrastructure Design の文書 | NFR1、C-C3 |

U1 の費用の見込み（試験運用の規模、東京リージョン）:

| サービス | 使う量の見込み | 無料枠 | 見込み |
|---|---|---|---|
| Lambda（Arm、128〜256 MB） | 月 1 万回未満 | 月 100 万回・40 万 GB 秒（常に無料） | 0 円 |
| API Gateway（HTTP API） | 月 1 万回未満 | 月 100 万回（12 か月） | 0 円 |
| DynamoDB（オンデマンド） | 月 数万回の読み書き、数 MB | 25 GB（常に無料）。オンデマンドの読み書きは 100 万回で約 0.25 ドル程度 | 0〜数円 |
| S3（写真・画面） | 数百 MB 未満 | 5 GB（12 か月） | 0 円 |
| CloudFront | 月 数 GB 未満 | 月 1 TB（常に無料） | 0 円 |
| Cognito | 利用者 20 人 | 月 5 万人（常に無料の範囲） | 0 円 |
| CloudWatch Logs・アラーム | 数十 MB、アラーム 2 つ | ログ 5 GB、アラーム 10 個 | 0 円 |
| SNS（メール） | 月 数十通 | 月 1,000 通 | 0 円 |

金額は公開の料金表と無料枠からの見込みで、請求の実績ではない（Bolt 1 の完了時に実績で確かめる）。

## 3. 運用の制約

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR12.1 | API の流量の制限: HTTP API の既定のステージで、全体を毎秒 10 リクエスト・瞬間 20 リクエストに制限する（試験運用の規模の数倍。超えたら 429） | CDK の構成の試験 | NFR12、project.md |
| NFR12.2 | Lambda のメモリは 128 MB を基本とし、写真の処理など重いものだけ 256 MB。256 MB を超えない | CDK の構成の試験 | NFR12、Q1 |
| NFR12.3 | Lambda のログの保存期間は 14 日以内（14 日に設定） | CDK の構成の試験 | NFR12、NFR11 |
| NFR12.4 | 常時起動・時間課金のリソース（EC2、RDS、NAT Gateway、Fargate、ElastiCache、WAF、Route 53 のホストゾーン、Lambda の常時起動の設定）を使わない。共用アカウントの mononoke のリソースに触れない | CDK の構成の試験（リソースの種類の一覧） | NFR12、project.md |

## Assumptions & Open Questions

- 流量の制限の値（毎秒 10・瞬間 20）は初期値。試験運用で 429 が出たら見直す。 [assumption]
- アカウントの作成から 12 か月を過ぎると、API Gateway と S3 の無料枠がなくなる。その場合も試験運用の規模では月 数円の見込み（feasibility の C-C4）。 [assumption]
