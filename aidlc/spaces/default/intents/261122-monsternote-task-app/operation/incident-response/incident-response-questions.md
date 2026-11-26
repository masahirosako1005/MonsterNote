## Q1. [運用] アラームの通知先メールを今回設定するか

本ステージの調査で、現在`dev`で動いている3つのCloudWatchアラーム（`masahiro-cloudwatch-monsternote-api-5xx`・`-lambda-errors-0`・`-lambda-errors-1`）はすべてSNSトピック`masahiro-sns-monsternote-alarm`に正しく通知するが、そのトピックには実際には誰も購読していない（`infra/.env.local`の`ALARM_EMAIL`が空欄のまま、これまでの`cdk deploy`で一度も`-c alarmEmail=...`を渡していないため）。つまりアラームが鳴っても今は誰にも届かない。メールアドレスを設定し、次回のデプロイで実際に購読させるか。

A. 今、メールアドレスを教えてもらい、次回のデプロイ（人の確認後）で設定する
B. 今回は設定せず、記録のみに留める（CloudWatchコンソールを自分で確認する運用を続ける）
X. Other (please specify)

[Answer]: A（2026-11-26・`mhiro10mhiro10@gmail.com`を設定し、人の承認後に`cdk deploy`で購読を作成、確認メールのリンクをクリックして購読済みを確認した。記録: f155a9f9・966e2359・9f8dd0e0）

## Q2. [運用] 「知らせのないまま残った報告」の再送手段を、手順書のままにするか画面機能として作るか

`runbooks.md` §6のとおり、送信の知らせ（EventBridgeへの送信）が3回とも失敗し、ハンターが送り直さずにやめた報告は、知らせのないまま残る（U1設計時点からの既知の受け入れたリスク）。U1の設計メモは「U4の管理者の画面で検討する」としていたが、実際にはU4でその機能は実装されていない。現状は、DynamoDBコンソールを人が直接操作して見つけ、手動でイベントを送り直すかeventSentを書き換える以外に復旧手段が無い。

A. 今回は手順書（人の手作業）のままにする。画面機能の追加は将来の改善として記録のみに留める
B. 管理者の画面に「知らせのないまま残った報告」を見つけて再送するボタンを追加する（コード変更。別途Code Generation相当の作業になる）
X. Other (please specify)

[Answer]: A（2026-11-26・AskUserQuestionで確認・記録519ee1b2）

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
