# NFR Design Questions — U3 `u3-review-list`

U3 の NFR 要件（performance・security・scalability・reliability・observability・tech-stack）のほとんどは、すでに具体の数値・条件・パターンまで決まっています。ここでは、設計の形として残っている判断だけを聞きます。

## Q1. [アーキテクト] Review と ReportCatalog を同じ関数にまとめるか

U1 の logical-components.md は「部品ごとに 1 つの関数」という考え方で、Review（承認・却下・取り消し）と ReportCatalog（一覧・絞り込み）は、すでに同じ Review 関連の Lambda にまとまっています（U1 の設計を U3 でも引き継ぐ前提）。U3 で却下・取り消し・絞り込みの処理を足すときも、この 1 つの関数にまとめ続けるか、絞り込み一覧（読み出しが多く、最大 2,000 件を読む可能性がある）だけを別の関数に分けるか、という選択です。

- A. 1 つの関数にまとめ続ける（U1 の構成をそのまま拡張する。小さな処理のために関数を増やすとコールドスタートが増えるため、U2 の DuplicateDetection のような「分ける理由」がない限り増やさない）
- B. 絞り込み一覧（`GET /v1/catalog/reports`）だけ別の関数に分ける（読み出し量の多い処理を、書き換え系（承認・却下・取り消し）から独立させる）
- X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 絞り込み一覧の読み出し中に DynamoDB が一時的に失敗したときの扱い

絞り込み一覧は、条件に合う行を最大 2,000 件まで、ページを跨いで読み進めます（nfr-requirements の見積もりでは 20 ページほど）。読み進めている途中のどこかのページで DynamoDB が一時的なエラー（スロットリングなど）を返したときに、一覧の応答をどう扱うかです。

- A. SDK の標準のやり直し（最大 3 回、指数のバックオフ）に任せ、それでも失敗したら、そこまでに読めた行で打ち切り、全件数は「見積もり（それ以上ある可能性）」として返す（一覧の表示を止めない。U2 の重複判定の 500 件打ち切りと同じ考え方）
- B. SDK のやり直しに任せ、それでも失敗したら一覧の呼び出し全体を失敗（502）として返す（やり直しは画面・利用者に任せる）
- X. Other (please specify)

[Answer]:A

## Q3. [運用] U3 で増えるログの項目に、新しい確認の仕組みを足すか

nfr-requirements の NFR10.24・NFR10.25 は「アラームは U1 の 2 つのまま増やさず、却下・取り消し・同時操作で弾かれた回数などは、必要なときに CloudWatch Logs Insights のクエリで確かめる」と決めています。これを設計でもそのまま使うか、保存しておくクエリ例をもう少し増やすかです。

- A. そのまま踏襲する。observability-design には、U2 と同じ形で Logs Insights のクエリ例（却下・取り消し・409 の回数、絞り込み上限に当たった回数）を書いておくだけにする
- B. 加えて、試験運用の期間中に手動で見る簡単な集計（却下理由の内訳など）のクエリ例も増やす
- X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
