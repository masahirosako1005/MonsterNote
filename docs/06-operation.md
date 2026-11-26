# 06. Operation（動かす）

## ゴール

Build and Test で確かめた「作れること」を、実際のAWS `dev`環境に反映し、動くことを実機で確かめる。この章ではOperationフェーズの最初の3ステージ（deployment-pipeline・environment-provisioning・deployment-execution）を扱う。

## 記録の読み方

Construction章と同じ（AIの質問・回答・承認ゲート）。加えてこの章では、実機デプロイでしか見つからない種類の不具合が2件見つかったので、その発見と修正の過程も記録する。

## 1. エンジンのルーティングの不具合と、会話内での進め方

このセッションでは`aidlc engine orchestrate next`が、以前のバッチ処理の再開に固まってしまう不具合が続いていたため（U3のバッチ差し戻しの節で記録済み）、Operationフェーズも同じ方針で進めた：各ステージの作業自体は実行するが、エンジンの自動ルーティングは使わず、ステージの判断・承認は会話の中で直接記録する（`aidlc engine log decision`・`log answer`）。

## 2. Deployment Pipeline・Environment Provisioning

`ci-pipeline`ステージは、既存の`.github/workflows/ci.yml`がすでに`npm run verify`と同等の検査をpush・PRのたびに実行しているため、CONDITIONALの既定条件（「既存のCIが整っていれば実行しない」）にしたがってスキップした。

`deployment-pipeline`はteam.md・project.mdにすでに記録済みの方針（手動デプロイ・単一`dev`環境・in-place置き換え・毎回人に確認）を正式な成果物として書き起こした。`environment-provisioning`はCDKソースから「設計上の在庫」（5スタック・12関数・14テーブル・30ルート）を書き出し、実機の現状（U1時点のまま再デプロイ未実施）と分けて記録した。

> 💡 教材ポイント: ここでも「サブエージェントの報告を鵜呑みにしない」が効いた。生成された`validation-report.md`は「Lambda・DynamoDB等へのタグ付けがソース上に見当たらない」と報告したが、実際には`infra/lib/tagging-aspect.ts`の`NameTagAspect`というCDK Aspectで全リソースに一括付与されていた（`Tags.of(...)`の個別呼び出しではなく、Aspectという別の仕組みを使っていたため、grep頼りの確認では見落とされた）。`cdk synth`したテンプレートを実際に確認して訂正した。また、テーブル数の変遷を記した別の文書（`rollback-runbook.md`）にも「7→12→13→14」という誤りがあり（U3は実はテーブルを増やしていない。正しくは7→12→12→14）、CDKソースを直接数えて訂正した。

また、両ステージの成果物が`<record>/construction/`配下に誤って作られていたことにも気づいた（stage file上は`phase: operation`なので、本来は`<record>/operation/`配下）。`<record>/operation/deployment-pipeline/`・`<record>/operation/environment-provisioning/`へ移動して訂正した。

## 3. `cdk diff` — 実機との差分確認

`AWS_PROFILE=default npx cdk diff --all`を実行し、結果を人に示して承認を得てからデプロイに進んだ。

- 削除される既存リソースは0件。既存7テーブルへの「置き換え」も無し（すべて新規追加）。
- 新規追加: テーブル7個・関数5個・ルート19個。`environment-provisioning`の事前予測（関数4個・ルート16個）よりわずかに多かった（見積もりの精度の問題で、内容自体に問題は無い）。
- すべて従量課金・サーバーレスのリソース。`mononoke-backend-dev`への参照も無し。

## 4. `cdk deploy` — 実際のデプロイと、見つかった2件の不具合

人の承認（`dev`へのデプロイを実行してよい、の確認）を得てから`cdk deploy --all --require-approval never`を実行した。

### 4.1 不具合1: CloudWatchアラームの指標数の上限超過

`MonsterNote-Auth-dev`・`MonsterNote-Web-dev`・`MonsterNote-Data-dev`は成功したが、`MonsterNote-Api-dev`が次のエラーで失敗した:

```
UPDATE_FAILED | AWS::CloudWatch::Alarm | LambdaErrorsAlarm
"Too many metrics in alarm, maximum is 10"
```

`infra/lib/api-stack.ts`の既存コードには「CloudWatchの数式は1つにつき最大10個の個別の指標まで」というコメントとともに、9個ずつの組にまとめた数式をさらに上位の数式で足し合わせる「入れ子」の工夫が書かれていた。しかし実際には、CDK/CloudFormationは入れ子の数式も最終的に1つのアラームの指標一覧として平らに展開するため、12関数分の指標＋入れ子の中間式2個＋最上位の式1個＝合計15個がそのまま上限（10個）に抵触した。

> 💡 教材ポイント: この「入れ子にすれば10個の上限を回避できる」という設計上の思い込みは、設計レビューでも単体試験（CDKの構成試験）でも検出できなかった。`cdk synth`で生成されるCloudFormationテンプレートの中身（`Metrics`配列の長さ）を見れば静的にも分かったはずだが、構成試験はそこまで数えていなかった。**実際に`cdk deploy`してCloudFormationの検証を通すまで分からない種類の不具合**があることを示す実例。

**修正**: 1つのアラームにまとめる設計をやめ、関数を9個以下ずつの組に分けて、組ごとに別々のアラームを作る設計に変更した（`masahiro-cloudwatch-monsternote-lambda-errors-0`・`-1`。12関数→9個＋3個の2組）。修正後、`cdk synth`したテンプレートで各アラームの指標数を直接数え（10個・4個）、上限内であることを確認してから再デプロイし、成功した。アラームが1個から2個に増えるが、CloudWatchの無料枠（10個まで無料）の範囲内でコストへの影響は無い。

### 4.2 不具合2: スモークテスト自身が古い送信内容のままだった

デプロイ成功後、`npm run smoke`を実行したところ、手順4「報告を送れる」が`422 VALIDATION_FAILED`で失敗した。しかし**これはバックエンドやデプロイの不具合ではなかった**。`scripts/smoke.ts`がU1スケルトン確認の時点のまま更新されておらず、Build and Testステージで追加した必須項目（尻尾の写真・`ageClass`・`captureMethod`・`capturedAt`・`capturedAtSource`・`locationSource`）を一度も送っていなかった。画面（`frontend/hunter`）自体はすでに正しく修正済み（単体試験・E2Eで確認済み）で、バックエンドの検証ロジックが意図どおり拒んだだけだった。

> 💡 教材ポイント: Build and Testで「ハンターの報告送信が常に失敗する」欠陥を直し、単体試験・E2Eは更新したが、実機確認用の`scripts/smoke.ts`は更新対象から漏れていた。これは本編のU2の「持ち越しの引き継ぎ漏れ」と同じ構造の教訓: **仕様やテストを直したとき、「本物のAWSに対して実際に確認するための経路」自体も、更新すべき対象の一覧に入れないと見落とされる**。

**修正**: `scripts/smoke.ts`に尻尾の写真のアップロードと、`ageClass`・`captureMethod`・`capturedAt`・`capturedAtSource`・`locationSource`を送る処理を追加し、再実行した。7手順すべて成功した。

## 5. デプロイ後の確認

`aws cloudformation describe-stacks`・`aws cloudwatch describe-alarms`で実際のAWS上の状態を確認した: 5スタックとも`UPDATE_COMPLETE`/`CREATE_COMPLETE`、3アラームとも`OK`。`mononoke-backend-dev`の最終更新時刻は今回のデプロイで変わっておらず、他プロジェクトへの影響が無いことを実機の値で確認した。

## 6. 残り（未着手）

observability-setup・incident-response・performance-validation・feedback-optimizationはまだ着手していない。特にperformance-validationは、今回の実機デプロイで初めてdev環境でのp95応答時間の実測が可能になった（Build and TestでUnverifiedとしていたNFR2.xの解消先）。
