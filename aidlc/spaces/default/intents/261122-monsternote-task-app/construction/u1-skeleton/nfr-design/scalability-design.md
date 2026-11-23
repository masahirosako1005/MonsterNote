# Scalability Design（規模・費用・運用の制約の設計）— U1 `u1-skeleton`

入力: `construction/u1-skeleton/nfr-requirements/scalability-requirements.md`（NFR1・NFR3・NFR12）、logical-components.md、nfr-design-questions.md、project.md。

| ID | 設計 |
|---|---|
| NFR3.1 | すべてサーバーレス（Lambda・HTTP API・DynamoDB オンデマンド・S3・CloudFront・Cognito・EventBridge）で、試験運用の規模に合わせた設定は要らない |
| NFR3.2 | 関数は状態を持たない（状態はすべて DynamoDB と S3）。同時の実行数の上限は設定しない（アカウント全体の上限の範囲。流量は API の入口で制限する） |
| NFR1.1 | 使うサービスは scalability-requirements の費用の見込み表のもの＋ EventBridge（独自の知らせ。月 数百件で 0.01 ドル未満）。どれも無料枠か 1 円未満 |
| NFR1.2 | CDK のアプリ全体に `Name=masahiro-<aws-service>-monsternote` のタグを付ける（サービスごとに名前を変える）。費用を分けるため、タグを請求のコスト配分タグとして有効にする（手順書。人の確認のあと） |
| NFR1.3 | Infrastructure Design で、リソースごとの無料枠と月額の見込みを表にしてから作る |
| NFR12.1 | HTTP API の既定のステージの流量の制限: 毎秒 10・瞬間 20。超えたら 429 |
| NFR12.2 | 関数のメモリ: Accounts・Review・ReportCatalog は 128 MB。Reporting は 256 MB（写真の確かめと署名付き URL）。CDK の構成の試験で 128〜256 MB を確かめる |
| NFR12.3 | すべての関数のロググループを CDK で作り、保存期間 14 日 |
| NFR12.4 | EC2・RDS・NAT Gateway・Fargate・ElastiCache・WAF・Route 53 のホストゾーン・Lambda の常時起動の設定・VPC を使わない（関数は VPC の外）。CDK の構成の試験で、これらのリソースの種類が含まれないことを確かめる。mononoke のリソースは名前のタグで区別し、触れない |

## Assumptions & Open Questions

- EventBridge の独自の知らせの料金は 100 万件で約 1 ドル。試験運用の規模では月 1 円未満の見込み。 [assumption]
