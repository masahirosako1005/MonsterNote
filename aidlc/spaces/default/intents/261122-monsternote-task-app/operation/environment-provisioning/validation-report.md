# Validation Report — Environment Provisioning

## 1. 実機（ライブAWS）検証は今回のパスでは未実施

本ステージを実行しているこのセッションにはAWSの認証情報へのアクセスが無く、`aws`コマンドやCDKの`diff`／`deploy`を実行していない。したがって本書で述べる「検証」はすべて**設計（CDKソース）レベルの確認**であり、**実際のAWSアカウント上の状態と突き合わせた確認ではない**。この区別を本ステージの成果物として明示することが、本ステージがこの時点で果たせる役割である。

## 2. 現在の実機の状態（分かっている事実。`docs/05-construction.md` §8参照）

| 時点 | デプロイされた内容 |
|---|---|
| U1完了時（ウォーキングスケルトン確認） | 5スタック・103リソースを`dev`へデプロイ済み。`npm run smoke`成功を確認済み |
| U2・U3・U4完了時（現在） | **`dev`への再デプロイは一度も行っていない** |

つまり現在`dev`で実際に動いているのは、U1時点のコード（Lambda関数8個、DynamoDBテーブル7個相当）であり、`environment-inventory.md`に記載した「設計上の在庫」（関数12個・テーブル14個・ルート30個）とは一致しない。**この差分は異常ではなく、Build and Testまでの作業がまだdeployment-executionステージ（実機への反映）に到達していないことの当然の結果**である。実機への反映は本ステージの対象外であり、次のdeployment-executionステージで、人の確認を経てから行う。

## 3. 推奨する最初のライブ検証手順

実際にAWSへデプロイする前に、次の順で確認することを推奨する（deployment-executionステージの入口、または本ステージの直後に人の承認を得て実施）:

1. **`cdk diff`をスタックごとに実行**（Auth→Web→Data→Api→WebContentの順。依存関係のとおり）。U1時点からの差分として、Lambda関数4個（AuditLog・DuplicateDetectionOnSaved・DuplicateDetectionOnStatus・CatalogOnStatus等、U2〜U4で追加されたもの）・DynamoDBテーブル7個（U2:5個＋U4:2個）・ルート16個（U1:14個からU2〜U4で追加された分）が新規作成として現れる見込み。
2. **コストの見積もりを示す**（project.mdのMandated）。差分がすべて従量課金・サーバーレスのリソース追加である想定どおりかを`cdk diff`の出力で確認する。
3. **既存データへの影響の有無を確認する**。`cdk diff`の出力で、既存7テーブル（Accounts・Photos・Reports・SubmissionKeys・ReviewDecisions・ReportListItems・ProcessedEvents）に対する「置き換え」（Replacement）がRequiresなしで新規追加のみであることを確認する。もし置き換えが示された場合は、`rollback-runbook.md` §4の手順に従い、人に個別に確認する。
4. 1〜3の結果を人に示し、`cdk deploy`の実行可否を確認してからdeployment-executionステージへ進む。

## 4. 無料枠・運用制約の充足状況（設計レベル）

| 基準（project.md Mandated/Forbidden） | 状況 |
|---|---|
| 常時課金・時間課金リソースを使わない | 設計上該当なし（`environment-inventory.md` §9） |
| Lambdaメモリ128〜256MB | すべての関数が範囲内（§6参照） |
| CloudWatch Logs保存14日以内 | すべてのロググループが`RetentionDays.TWO_WEEKS`（14日） |
| APIスロットリング | HTTP APIの`$default`ステージに`rateLimit: 10`・`burstLimit: 20`を設定済み |
| リソースタグ`Name=masahiro-<aws-service>-monsternote` | **確認済み**。`infra/lib/tagging-aspect.ts`の`NameTagAspect`（`CfnResource`を持つすべてのリソースを巡回し`Name`・`Project`タグを付与するCDK Aspect）を`infra/lib/monsternote.ts`で`Aspects.of(app).add(new NameTagAspect())`として全スタック共通で適用済み。`Tags.of(...)`という個別呼び出しではなくAspect方式のため、最初の確認では見落としていた（訂正済み）。実際に`cdk synth`した`MonsterNote-Data-dev`テンプレートで`AccountsTable`に`Name=masahiro-dynamodb-monsternote`・`Project=monsternote`が付くことを確認した |
| mononokeのリソースに触れない | 設計上、すべてのリソースは本プロジェクトのCDKアプリ内で新規に作られており、既存の`mononoke-backend-dev`スタックへの参照・変更は無い（`docs/05-construction.md` §8のbootstrap記録と整合） |

## 5. 結論（Readiness）

- **設計レベルでの無料枠・運用制約の充足**: 満たしている（§4。タグ付けを含め、見落としを訂正のうえ確認済み）。
- **実機デプロイの準備状況**: `cdk diff`による実機との突き合わせが次の必須ステップ。これを行わずに`cdk deploy`へ進むことは推奨しない。
- **次のアクション**: deployment-executionステージで、本書§3の手順（`cdk diff`→コスト提示→人の承認）を経てから実際のデプロイを行う。実際にAWSへ触れる操作はこのステージの範囲外であり、ここでは一切実行していない。
