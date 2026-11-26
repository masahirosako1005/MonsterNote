# Cost Analysis — Feedback & Optimization

入力: `operation/environment-provisioning/environment-inventory.md`（設計上の在庫）、`operation/deployment-execution/deployment-log.md`（実際にデプロイされた構成）、`aidlc/spaces/default/memory/{project,team}.md`（無料枠方針・既存のAWS Budgetsの使用方針）、AWS Cost Explorer・AWS Budgets（本ステージで実際に読み取り専用で確認）。

## 1. 実測コスト（AWS Cost Explorer。実際に確認した数値）

`AWS_PROFILE=default aws ce get-cost-and-usage`（2026-11-01〜2026-11-27、`us-east-1`）を実際に実行した。**これは実測値であり、見積もりではない。**

| サービス | 当月のUnblendedCost |
|---|---|
| AWS Lambda | $0.0000018252 |
| Amazon S3 | $0.0000000011 |
| AWS Data Transfer | -$0.0000018268（丸め誤差。実質0） |
| Amazon API Gateway / CloudFront / Cognito / DynamoDB / SNS / CloudWatch / CloudWatch Events / CloudFormation / Amplify / Glue / KMS | すべて $0 |

**当月の実測合計は実質 $0.00**（共用アカウント全体の値。mononokeの分も含むが、mononoke側も含めて全サービスが$0またはマイクロセント単位の丸め誤差のみ）。project.mdの目標「~$0/month」を実測で満たしている。

## 2. タグ別の内訳は取得できなかった（見つけたギャップ）

`infra/lib/tagging-aspect.ts`の`NameTagAspect`により、すべてのリソースに`Project: monsternote`タグは正しく付いている（`environment-provisioning/validation-report.md`で確認済み）。しかし`aws ce get-cost-and-usage --group-by Type=TAG,Key=Project`を実行したところ、`Keys: ["Project$"]`（値が空欄）という1グループのみが返り、`monsternote`というタグ値での内訳は得られなかった。

**原因**: AWS Cost Explorerがタグでグループ化・絞り込みをするには、そのタグを「コスト配分タグ」としてBilling設定で**有効化**する必要がある（リソースにタグが付いているだけでは不十分。別工程）。実際に`aws ce list-cost-allocation-tags`で確認したところ、`Project`タグは`Status: Inactive`（使われてはいる`LastUsedDate`あり、しかし配分タグとしては無効）だった。team.md/project.mdが前提とする運用（「タグ別に請求コンソールで確かめる」）は、現時点では実行できない状態にある。

人に報告し（記録: bf3f347f）、今回は有効化を見送る判断を得た（合計金額が$0とすでに確認できているため、タグ別の内訳までは当面不要）。共用アカウント全体（mononoke含む）のBilling設定の変更になるため、本ステージの一存では行わなかった。

## 3. 既存のAWS Budgets（新規作成はしていない。読み取りのみ確認）

`aws budgets describe-budgets`で、この共用アカウントにすでに2つのBudgetが存在することを確認した（どちらも本ステージで作成したものではない）:

| Budget名 | 上限 | 当月の実際の支出 | 予測支出 | 状態 |
|---|---|---|---|---|
| `AWS予算-AWS Buget` | $6.00/月 | $0.00 | $0.065 | HEALTHY |
| `mononoke-monthly-cost-alert` | $10.00/月 | $0.00 | $0.065 | HEALTHY |

team.md/project.mdの方針（「既存のAWS Budgetsを使う」）どおり、新しいBudgetは作成していない。どちらも上限に対して実質0%の消費で、超過の兆候は無い。

## 4. 無料枠に対する現在の消費見込み（設計上の見積もり。§1の実測と対になる文脈）

実測が$0であることと整合する範囲で、デプロイ済みリソースの無料枠消費率の目安（`environment-inventory.md`の在庫どおり）:

| リソース | 現在の個数 | 無料枠 | 消費率の目安 |
|---|---|---|---|
| Lambda呼び出し | 試験運用規模（月50件未満の報告） | 月100万回無料 | ごく僅か |
| DynamoDB（PAY_PER_REQUEST） | 14テーブル | オンデマンドは常時無料枠の対象外だが、試験運用規模の読み書き量は極小 | ごく僅か |
| CloudWatchアラーム | 3個 | 10個まで無料 | 3/10 |
| CloudWatchダッシュボード | 1個（`masahiro-cloudwatch-monsternote-operations`） | 3個まで無料 | 1/3 |
| S3（写真。ライフサイクル1日で自動削除） | 1バケット | 5GBまで無料（12か月。アカウントの作成時期により適用有無は要確認） | ごく僅か（1日で自動削除されるため蓄積しない） |
| CloudFront | 2ディストリビューション | 1TB/月まで無料（12か月） | ごく僅か |

**常時課金リソース（EC2・RDS・NAT Gateway等）は一切無い**（`environment-inventory.md` §9のとおり、設計上も実機上も該当なし）。

## Assumptions & Open Questions

None（§2のQ1は人に報告し、今回は見送る判断を得て解決済み）。
