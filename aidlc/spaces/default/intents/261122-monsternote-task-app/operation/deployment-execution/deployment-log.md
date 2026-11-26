# Deployment Log — Deployment Execution

## 1. 前提確認

- `aws sts get-caller-identity`相当の確認: AWS CLI `default`プロファイル（`ap-northeast-1`）でAWSに接続できることを、`cdk diff --all`（事前の差分確認）が正常に完了したことで確認済み。アカウント下4桁: `**********4230`。
- `cdk diff --all`の内容（テーブル7個・関数5個・ルート19個の新規追加、既存リソースの削除・置き換えなし）を人に提示し、`dev`へのデプロイの実行可否を確認した（承認: メッセージ87f1c589）。

## 2. 実行したコマンドと結果

### 2.1 初回 `cdk deploy --all --require-approval never`

| スタック | 結果 |
|---|---|
| `MonsterNote-Auth-dev` | ✅ 成功（9.12秒） |
| `MonsterNote-Web-dev` | ✅ 成功（差分なし） |
| `MonsterNote-Data-dev` | ✅ 成功。新規テーブル7個（DetectionResults・ReportFootprints・DuplicateSuspicions・Settings・DetectionRateLimits・AdminCounter・AuditEntries） |
| `MonsterNote-Api-dev` | ❌ **失敗**（§3参照） |

### 2.2 原因調査・修正・再デプロイ

`infra/lib/api-stack.ts`を修正（§3）し、`npx tsc --noEmit`・`npx vitest run infra/test`（67件成功）・`npm run synth`（合成したテンプレートで各アラームの指標数を直接確認: グループ0=10個、グループ1=4個。いずれも10以下）で確認してから再実行した。

| スタック | 結果 |
|---|---|
| `MonsterNote-Api-dev`（再実行） | ✅ 成功（137.74秒） |
| `MonsterNote-WebContent-dev`（続けて実行） | ✅ 成功（117.25秒。画面ビルド成果物の配置とCloudFrontキャッシュの無効化） |

## 3. 発見した欠陥と修正（実機デプロイで初めて表面化。設計レビュー・単体試験では検出不可能だった）

**事象**: `MonsterNote-Api-dev`のデプロイが次のエラーで失敗した。

```
UPDATE_FAILED | AWS::CloudWatch::Alarm | LambdaErrorsAlarm
Resource handler returned message: "Too many metrics in alarm, maximum is 10
(Service: CloudWatch, Status Code: 400 ...)"
```

**原因**: `infra/lib/api-stack.ts`の`LambdaErrorsAlarm`（全関数のエラー合計を1つのアラームにまとめる設計）は、関数が増えてもCloudWatchの上限（1アラームにつき指標は合計10個まで）を超えないよう、9個ずつの組にまとめた数式を、さらに上位の数式で足し合わせる「入れ子」構造で回避しようとしていた（U2で関数が11個になった時点のコード中のコメントに、その設計意図が明記されていた）。しかし実際には、CDK/CloudFormationは入れ子になった数式も最終的に1つのアラームの指標一覧として平らに展開するため、合計の指標数（個々の関数のエラー指標12個＋入れ子の中間式2個＋最上位の式1個＝15個）がそのまま上限に抵触し、デプロイが失敗した。この挙動は`cdk diff`のテンプレート比較では（変更差分としては見えるが）エラーとしては現れず、実際に`cdk deploy`してCloudFormationのバリデーションを通すまで判明しなかった。

**修正**: 1つのアラームにまとめる設計をやめ、関数を9個以下ずつの組に分け、組ごとに別々のアラーム（`masahiro-cloudwatch-monsternote-lambda-errors-0`・`-1`）を作る設計に変更した（`infra/lib/api-stack.ts`）。12関数は9個＋3個の2組に分かれ、それぞれの指標数は10個・4個でいずれも上限内。両方のアラームを同じSNSトピックに接続しているため、どちらの組で閾値（5分間でエラー合計3回以上）を超えても通知は届く。

**影響範囲の確認**: この変更はCloudWatchアラームの定義のみで、Lambda関数・DynamoDBテーブル・API Gatewayルート等の実際のアプリケーションリソースには影響しない。アラームが1個から2個に増えるが、CloudWatchの無料枠（アラーム10個まで無料）の範囲内であり、追加コストは発生しない。

**テスト・ドキュメントへの反映**:
- `infra/test/stacks.u1.test.ts`: アラーム数のテストを2個→3個に、名前を`-0`・`-1`付きに更新。
- `aidlc/spaces/default/intents/261122-monsternote-task-app/operation/environment-provisioning/environment-inventory.md` §6: アラーム数の記載を2個→3個に訂正し、原因と対処を追記。

## 4. ファイル配置の訂正

`deployment-pipeline`・`environment-provisioning`の両ステージ（`phase: operation`）の成果物が、誤って`<record>/construction/`配下に作られていた（本来は`<record>/operation/`配下）。本ステージの実行時に発見し、`<record>/operation/deployment-pipeline/`・`<record>/operation/environment-provisioning/`へ移動した（git管理下に入っていなかったため、単純なファイル移動で対応。履歴の欠落なし）。

## 5. 現在の`dev`環境（デプロイ後）

| 項目 | 値 |
|---|---|
| ハンター画面 | `https://d39gl3iwb322u9.cloudfront.net` |
| 依頼元画面 | `https://d1mc7hjb9nzwys.cloudfront.net` |
| API | `https://sp1tuuoxfj.execute-api.ap-northeast-1.amazonaws.com` |
| Cognitoユーザープール | `ap-northeast-1_Ow9zMCMJf` |

デプロイ前後でURLは変わっていない（Auth・Webスタックに変更がなかったため）。`mononoke-backend-dev`スタックへの参照・変更は一切行っていない。
