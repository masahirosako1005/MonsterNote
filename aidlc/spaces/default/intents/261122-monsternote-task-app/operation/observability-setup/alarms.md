# Alarms — Observability Setup

入力: `construction/u1-skeleton/infrastructure-design/monitoring-design.md`（アラーム 2 つの原案）、`construction/u2-report-duplicate/infrastructure-design/monitoring-design.md`・`construction/u3-review-list/infrastructure-design/monitoring-design.md`・`construction/u4-accounts-admin/infrastructure-design/monitoring-design.md`（U2〜U4 は「アラームを増やさない」の継続確認）、`construction/u1-skeleton/nfr-design/observability-design.md`・`reliability-design.md`（Q6: アラームなしで受け入れたリスクの一覧）、`infra/lib/api-stack.ts`（実装）、`operation/deployment-execution/deployment-log.md`・`health-check-report.md`（実機での結果）。

## 1. 現在 `dev` に実際にあるアラーム（3 個）

monitoring-design（U1〜U4）は一貫して「アラームは 2 つ、増やさない」という設計だったが、`deployment-execution`（本番反映）で実装上の制約に当たり、**実際には 3 個**になっている。この文書は設計意図ではなく、実際にデプロイされている構成を記録する。

| アラーム名 | 対象の指標 | 条件 | 重大度 | 通知先 |
|---|---|---|---|---|
| `masahiro-cloudwatch-monsternote-api-5xx` | `AWS/ApiGateway` の `5xx`・`Count`（HTTP API、5 分間の Sum） | メトリクス計算式 `IF(Count >= 5, 5xx / Count * 100, 0)` が 1 期間（5 分）で 5 を超える。データなしは `notBreaching` 扱い | 高（API の成功率 99%／30 日の目安を割る前に気づく） | SNS `masahiro-sns-monsternote-alarm` → 開発者のメール |
| `masahiro-cloudwatch-monsternote-lambda-errors-0` | 関数グループ 0（`Accounts`・`AuditLog`・`Reporting`・`Review`・`Catalog`・`Settings`・`DuplicateDetection`・`ReviewOnSaved`・`CatalogOnSaved` の 9 関数）の `Errors`（Sum） | 5 分間で合計 3 回以上。`notBreaching` | 高 | 同上 |
| `masahiro-cloudwatch-monsternote-lambda-errors-1` | 関数グループ 1（`CatalogOnStatus`・`DuplicateDetectionOnSaved`・`DuplicateDetectionOnStatus` の 3 関数）の `Errors`（Sum） | 5 分間で合計 3 回以上。`notBreaching` | 高 | 同上 |

SNS トピック `masahiro-sns-monsternote-alarm` は 1 つで、3 つのアラームすべてがこれに流れる。どちらの関数エラーのアラームが鳴っても、開発者には同じメール 1 通が届く。`health-check-report.md` の確認時点（デプロイ直後）では 3 個とも `OK`。

## 2. なぜ 2 個ではなく 3 個になったか（実機デプロイで判明した欠陥）

`infra/lib/api-stack.ts` の設計は、当初「全関数のエラー合計を 1 つのアラーム（1 つの入れ子の数式）にまとめる」ものだった。U2 で関数が 11 個になった時点のコメントに、CloudWatch の「1 アラームにつき指標は合計 10 個まで」という上限を、9 個ずつの組にまとめた数式をさらに上位の数式で足し合わせる「入れ子」構造で回避する、という設計意図が書かれていた。

しかし CloudFormation は入れ子の数式も最終的に 1 つのアラームの指標一覧として平らに展開するため、実際の指標数（関数ごとのエラー指標 12 個＋入れ子の中間式 2 個＋最上位の式 1 個＝15 個）がそのまま上限 10 に抵触し、`MonsterNote-Api-dev` のデプロイが `UPDATE_FAILED`（`Too many metrics in alarm, maximum is 10`）で失敗した（`deployment-log.md` §3）。`cdk diff` の差分比較では検出できず、実際に `cdk deploy` して CloudFormation の検証を通すまで分からなかった欠陥であり、設計レビュー・単体試験の層では見つけられない種類の不具合だった。

修正は「1 つにまとめる」のをやめ、関数を 9 個以下ずつの組に分けて、組ごとに別々のアラームにする方式（上の表の `-0`・`-1`）。両方とも同じ SNS トピックに通知するため、どちらの組で閾値を超えても気づける。これにより **CloudWatch の無料枠（アラーム 10 個まで無料）は 3/10 を使用中**。U1〜U4 の monitoring-design が前提としていた「2 個のうち」という書き方は、この構成変更を踏まえて訂正が必要（`team.md`/`project.md` の Corrections に、関数構成を確かめずに前提を書かない、という学びがすでにある）。

## 3. 新しい関数が増えたときの指標数の見積もり

現在 12 関数を 9＋3 に分けている。今後関数が増える場合、グループ 1 側（現在 3 個）に足すか、新しいグループ 2 を作るかの判断が必要になる。1 グループは最大 9 関数（9 指標）まで安全に収容できる（グループ内の数式自体は `m0+m1+...` の単純な和で、入れ子にしない。入れ子にすると今回と同じ理由で上限に抵触するため、**この単純な和の形を崩さないこと**が CDK 変更時の制約になる）。

## 4. 意図してアラームを作らなかったもの（受け入れたリスク。Q6/Q3-A/Q4-A の一貫した決定）

NFR Design・Infrastructure Design の各 Unit で、次はアラームを作らず「必要なときにログで見る」設計にすると決めている（`log-queries.md` に対応するクエリを用意）。本ステージでもこの決定を覆さない。

| 事象 | ログの `errorCode`/項目 | 決定した Unit |
|---|---|---|
| 知らせの送信失敗（報告の保存・承認・却下・取り消し・操作記録） | `EVENT_PUBLISH_FAILED` | U1（Q6）・U3 §2（取り消しは 1 回だけ送信を試す設計のため特に起きやすい） |
| 判別（Rekognition）の呼び出し上限超過 | `DETECTION_LIMIT_REACHED` | U2 |
| 送信前の重複問い合わせの失敗 | `DUPLICATE_CHECK_FAILED` | U2 |
| 重複判定の読み出しが 500 件の上限に到達 | `readCount`／`limitReached` | U2 |
| 絞り込み一覧が 2,000 件の上限に到達 | `FILTER_LIMIT_REACHED` | U3 |
| 同時操作で 409 に弾かれた（承認済み・取り消し済み・期限切れ） | `ALREADY_DECIDED`／`ALREADY_UNDONE`／`UNDO_EXPIRED` | U3 |
| 管理者の無効化が拒まれた | `CANNOT_DISABLE_SELF`／`LAST_ADMIN` | U4 |
| 「すべて削除」の実行結果 | `componentName`／`deletedCount` | U4 |

EventBridge の配達自体（`report.saved`・`review.status-changed`・`duplicate.suspected`・`audit.recorded`）は標準のやり直し（最大 24 時間・185 回）に任せ、DLQ もアラームも作らない（U1 reliability-design、受け入れたリスクとして全 Unit で踏襲）。

## 5. 本ステージで新たに見つけたギャップ（人に報告し、記録のみに留める判断を得た）

どの Unit の NFR/Infrastructure Design にも、**DynamoDB のスロットリング（読み書きのキャパシティ超過）**への言及がない。14 個の表はすべて `PAY_PER_REQUEST`（オンデマンド）のため定常的なスロットリングは起きにくいが、オンデマンドにも瞬間的なバーストへの内部制限があり、`ReportListItems`（`gsiAll`・`gsiHunter` の 2 GSI）や `AuditEntries`（`gsiAll`）のように GSI を持つ表では、書き込みが GSI 側のスループットで絞られる可能性がある。現在の試験運用の規模（月 50 件未満の報告）では顕在化しにくいが、**この見落としは監視の設計からの脱漏であり、受け入れたリスクとして明記されたものではない**。

人に報告し（記録: f6a5a28c）、DynamoDBのスロットリング・EventBridgeの配達失敗を監視する新しいアラームは追加しない（既存の3つの関数系アラームで十分とする）との判断を得た。記録のみに留め、修正は行わない。EventBridgeの配達失敗については、アラームではなく`dashboards.md`のウィジェットとして視認性だけは確保した。

## Assumptions & Open Questions

None.
- `masahiro-cloudwatch-monsternote-lambda-errors-0`／`-1` という名前の末尾の番号は、関数の追加順（`this.functions` に登録した順）に依存する実装の都合であり、業務上の意味を持たない。将来関数の登録順を変える CDK の変更があれば、この番号の対応関係も変わりうる。 [assumption]
