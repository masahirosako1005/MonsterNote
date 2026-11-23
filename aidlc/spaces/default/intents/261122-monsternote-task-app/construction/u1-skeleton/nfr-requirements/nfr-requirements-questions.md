# NFR Requirements — 質問（U1 `u1-skeleton`）

前提: `construction/u1-skeleton/functional-design/`（U1 の設計）、`inception/requirements-analysis/requirements.md`（NFR1〜NFR14: 月 100 円以内、応答時間、認証と認可、データの保護、アクセシビリティ、運用の制約 など）、`inception/contract-design/contract-summary.md`（時間切れ 10 秒・2 秒、知らせ）、`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`（TypeScript、Lambda・API Gateway・DynamoDB・Cognito・S3・CloudFront、CDK を優先）、project.md（無料枠、常時課金のリソースは使わない、Lambda のメモリ 128〜256 MB、ログ 14 日以内、API の流量の制限）。

このステージでは、U1 の非機能の要件（性能・セキュリティ・規模・信頼性・監視）を数値で決め、使う技術を選びます。技術の候補は technical-environment.md と project.md の範囲から出しています。U1 で選んだ技術は、U2〜U4 でも使います。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 裏側の関数（Lambda）の実行環境は、どうしますか？

A. Node.js 22（TypeScript をビルドして動かす）、Arm（Graviton。x86 より安い）、メモリ 128 MB を基本とし、写真の処理など重いものだけ 256 MB
B. Node.js 22、x86、メモリはすべて 256 MB
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] データベース（DynamoDB）の表の分け方は、どうしますか？

A. 部品ごとに表を分ける（Accounts・Reporting・Review・ReportCatalog など）。データの持ち主の部品だけが自分の表を読み書きする（Domain Design の決まりどおり）。料金は使った分だけ（オンデマンド）
B. 1 つの表にすべてのデータを入れる（シングルテーブル設計）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] ログインの仕組み（認証のサービス）は、どうしますか？

A. Amazon Cognito のユーザープール。管理者がユーザーを作る設定（自分での登録はなし）。ログインの証明の期限 1 時間、出し直し用の値 30 日（contract-summary C1）。月 5 万人まで無料
B. 自分でログインの仕組みを作る
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] API の入口（API Gateway）の種類は、どうしますか？

A. HTTP API（安く、Cognito の証明の確認を組み込みで使える。道ごとに流量の制限を設定できる）
B. REST API（機能は多いが料金が約 3.5 倍。12 か月の無料枠は月 100 万回）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] 画面アプリの作り方と公開の方法は、どうしますか？

A. React ＋ MUI を Vite でビルドした静的なファイルを、S3 に置き CloudFront で公開する（S3 は CloudFront からだけ読める設定）。ハンター用と依頼元用を別々の CloudFront で公開する（U4 で管理者用を足す）
B. 3 つのアプリを 1 つの CloudFront の下に、道（`/hunter`、`/requester`、`/admin`）で分けて公開する
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q6. [アーキテクト] 動作の監視（ログ・アラーム）は、どこまでにしますか？

A. 構造化した JSON のログを CloudWatch Logs に 14 日保存する（氏名・位置・従事者番号は出さない）。アラームは「API の 5xx の割合」と「Lambda のエラー」の 2 つだけ（CloudWatch のアラームは 10 個まで無料）を、メール（SNS）で知らせる。処理の追跡（X-Ray）は使わない
B. A に加えて X-Ray で処理を追跡する（月 10 万件まで無料）
C. ログだけで、アラームは作らない
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q7. [アーキテクト] 試験運用の間の「動いている割合」の目標は、どうしますか？

requirements NFR10 では独自の目標を設けないとしましたが、監視（アラーム）の基準のために、測る目安を決めます。

A. 30 日間で、API への呼び出しの 99% 以上が成功（5xx ではない）を目安とし、5 分間で 5xx が 5% を超えたらアラームを出す
B. 目安は決めず、アラームは 5xx が 1 件でも出たら知らせる
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Lambda: Node.js 22（TypeScript をビルド）、Arm（Graviton）、メモリ 128 MB を基本、重い処理だけ 256 MB [Q1]
- データベース: DynamoDB を部品ごとの表に分け、持ち主の部品だけが読み書きする。オンデマンドの料金 [Q2]
- ログイン: Cognito のユーザープール（管理者がユーザーを作る、自分での登録なし）。証明 1 時間、出し直し用の値 30 日 [Q3]
- API の入口: API Gateway の HTTP API。Cognito の証明の確認を組み込みで使い、道ごとに流量を制限する [Q4]
- 画面: React ＋ MUI を Vite でビルドし、S3 ＋ CloudFront で公開（S3 は CloudFront からだけ）。ハンター用と依頼元用は別々の CloudFront [Q5]
- 監視: JSON のログを CloudWatch Logs に 14 日（氏名・位置・従事者番号は出さない）。アラームは API の 5xx の割合と Lambda のエラーの 2 つをメールで。X-Ray は使わない [Q6]
- 動いている割合の目安: 30 日間で API の呼び出しの 99% 以上が成功。5 分間で 5xx が 5% を超えたらアラーム [Q7]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
