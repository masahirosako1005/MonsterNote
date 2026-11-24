# NFR Design Questions — U4 `u4-accounts-admin`

U4 の NFR 要件（AdminCounter の条件付き書き込み、削除の順番、記録の作り方など）は、機能設計とレビューを通じてすでに具体の論理まで決まっています。ここでは、設計の形として残っている判断だけを聞きます。

## Q1. [アーキテクト] 新しい処理をどこに配置するか

U4 で新しく動く処理は、AuditLog（操作の記録の受け手と一覧）と、「すべて削除」の 5 つの入口（ReportCatalog・Review・DuplicateDetection・SpeciesDetection・Reporting の各部品に 1 つずつ）です。U1〜U3 は「部品ごとに 1 つの関数」の原則で来ていますが、削除の入口は**既存の部品の関数に処理を足す**か、**削除専用の新しい関数を部品ごとに作る**かで配置が変わります。

- A. 既存の部品の関数にそれぞれ処理を足す（Accounts の関数に AdminCounter・アカウント作成を、ReportCatalog・Review・DuplicateDetection・SpeciesDetection・Reporting の各関数に削除の入口を足す。AuditLog だけは新しい受け手の関数を 1 つ作る。関数を増やしすぎない）
- B. 削除は部品ごとに専用の関数を新しく作る（管理者の操作という性格が通常の API と異なるため、IAM の権限を削除専用に絞って分離する）
- X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 数百件規模の削除を、DynamoDB の 1 回 25 件までという制約の中でどう行うか

「すべて削除」は、試験運用の期間の累計で報告・写真などが数百件になる見込みです（NFR3.10）。DynamoDB の `BatchWriteItem` は 1 回の呼び出しで最大 25 件までしか消せないため、数百件を消すには複数回の呼び出しが要ります。これを 1 つの入口の API 呼び出し（NFR2.18 の 10 秒以内）の中でどう行うかという設計です。

- A. 1 回の API 呼び出しの中で、25 件ずつの `BatchWriteItem` をループで繰り返し、全部消し終えてから応答する（U3 の絞り込み一覧と同じく、1 回の呼び出しの中でページを跨ぐ。数百件なら 10 秒以内に収まる見込み）
- B. 1 回の API 呼び出しでは一部（例 100 件）だけ消し、続きがあるかどうかを応答に含め、画面が「続きがある」間は同じ入口をもう一度呼ぶ（1 回の呼び出しを軽くする代わり、画面の繰り返し呼び出しが必要になる）
- X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] アカウント作成時の、認証サービス（Cognito）への呼び出しと DynamoDB への書き込みの順番

アカウントの作成は、認証サービス（Cognito）側の利用者の作成と、DynamoDB 側の Account・AdminCounter の書き込み（1 つのまとまった書き込み）の、2 つの別々の操作からなります（機能設計の Assumptions に「認証のサービス側の作成だけが別の書き込みになる」とある）。どちらを先に行うかで、途中で失敗したときの状態が変わります。

- A. 認証サービス（Cognito）側を先に作り、成功したら DynamoDB 側を書く（機能設計の Assumptions が前提にしている順番。DynamoDB 側が失敗すると「認証サービスにはあるが MonsterNote のデータにはない」状態になるが、同じ ID でもう一度作ろうとすると認証サービス側で 409 になるため、管理者が気づける）
- B. DynamoDB 側を先に書き、成功したら認証サービス（Cognito）側を作る（DynamoDB 側が失敗すれば何も残らずやり直せるが、認証サービス側が失敗すると「MonsterNote のデータにはあるが、ログインできないアカウント」が残り、気づきにくい）
- X. Other (please specify)

[Answer]:A

## Q4. [運用] 監視の確認の仕組みを U2・U3 と同じにするか

nfr-requirements の NFR10.31・NFR10.32 は「アラームは U1 の 2 つのまま増やさず、アカウントの操作・削除の実行・設定の変更は、必要なときに CloudWatch Logs Insights のクエリで確かめる」と決めています。これを設計でもそのまま使うか、保存しておくクエリ例をもう少し増やすかです。

- A. そのまま踏襲する。observability-design には、U2・U3 と同じ形で Logs Insights のクエリ例（アカウントの作成・無効化、削除の実行、設定の変更の回数）を書いておくだけにする
- B. 加えて、試験運用の終わりに向けて、削除の実行結果（成功・失敗）を一覧できるクエリ例も増やす
- X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
