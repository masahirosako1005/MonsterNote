# Infrastructure Design — 質問（U1 `u1-skeleton`）

前提: `construction/u1-skeleton/nfr-design/`（論理的な構成要素 L1〜L9、セキュリティ・信頼性の設計。レビューの残り: 写真のアップロードを署名付きの POST にしたが約束と CORS が合っていない〈Major〉、トークンの更新と 2 つのタブ〈Minor〉）、`construction/u1-skeleton/nfr-requirements/tech-stack-decisions.md`、`inception/practices-discovery/team-practices.md`（AWS は dev の 1 つ、人の確認のあと手元から `cdk deploy`、git タグで戻す、CI は AWS に接続しない）、project.md（タグ、無料枠、常時課金の禁止、mononoke に触れない）。

このステージでは、AWS の具体の構成（CDK のスタック、リソースの設定）と、ビルド・試験・デプロイの流れ（CI/CD）を決めます。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [AWS プラットフォーム] 写真のアップロードの方式は、どちらにしますか？（NFR Design のレビューの Major）

A. 署名付きの POST のまま。約束（contract-summary C2）の `POST /v1/photos` の応答に、POST に必要な項目（`uploadFields`）を足す（項目を足すだけの変更）。写真の S3 の CORS に POST を許す。大きさの上限（15 MB）を S3 が強制できる
B. 署名付きの PUT に戻す（約束のとおり）。大きさは S3 では制限できないため、アップロードの完了の確認（BR2.9）で 15 MB を超えたら消す。消すまでの間だけ大きな写真が置かれる
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q2. [AWS プラットフォーム] CDK のスタック（まとめてデプロイする単位）の分け方は、どうしますか？

A. 役割ごとに 4 つのスタックに分ける: ① 認証（Cognito）② データ（DynamoDB の表、写真の S3。消さない設定）③ API（HTTP API、関数、EventBridge）④ 画面（2 つの S3 と CloudFront）。データのスタックを分けておくと、API や画面を作り直してもデータが残る
B. 1 つのスタックにすべてを入れる（簡単だが、作り直しのときにデータを巻き込みやすい）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q3. [AWS プラットフォーム] デプロイの前の確認は、どうしますか？（team-practices: 人の確認のあと手元から `cdk deploy`）

A. デプロイの前に、AI が `cdk diff`（何が変わるか）と、新しく作るリソースの無料枠と月額の見込みを示し、人が承認してから `cdk deploy` を実行する。デプロイのあと `npm run smoke` を実行し、通ったら git のタグ（`v0.1.0` など）を付ける
B. `cdk diff` は省き、人の承認だけで `cdk deploy` する
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [AWS プラットフォーム] トークンの更新（出し直しのたびに新しいリフレッシュトークン）で、2 つのタブから同時に出し直したときの扱いは、どうしますか？（NFR Design のレビューの Minor）

A. Cognito の「再利用の猶予」（古いリフレッシュトークンを短い間だけ使えるようにする設定）を 60 秒にする。2 つのタブが同時に出し直してもログアウトされない
B. 猶予は 0（同時に出し直すと片方がログアウトされる。もう一度ログインする）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [AWS プラットフォーム] アラームのメールの宛先と、手元の設定は、どう渡しますか？

A. デプロイのときに CDK のコンテキストの値（`-c alarmEmail=...`）で渡す。値は手元の `cdk.context.json` に置かず、`.gitignore` した手元のファイル（`infra/.env.local`）から読む。リポジトリにメールアドレスを書かない
B. CDK のコードに直接書く（公開のリポジトリに載る）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 写真のアップロード: 署名付きの POST のまま。約束 C2 の `POST /v1/photos` の応答に `uploadFields` を足す（足すだけの変更）。写真の S3 の CORS に POST を許す。15 MB の上限は S3 が強制する [Q1]
- CDK のスタック: 4 つ（① 認証 Cognito ② データ DynamoDB・写真の S3〈消さない設定〉③ API HTTP API・関数・EventBridge ④ 画面 2 つの S3 と CloudFront） [Q2]
- デプロイの前の確認: AI が `cdk diff` と新しいリソースの無料枠・月額の見込みを示し、人が承認してから `cdk deploy`。デプロイのあと `npm run smoke`、通ったら git のタグ [Q3]
- トークンの更新: Cognito の再利用の猶予を 60 秒にする（2 つのタブで同時に出し直してもログアウトされない） [Q4]
- アラームのメール: デプロイのときに CDK のコンテキストの値で渡し、値は `.gitignore` した手元のファイル（`infra/.env.local`）から読む。リポジトリに書かない [Q5]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
