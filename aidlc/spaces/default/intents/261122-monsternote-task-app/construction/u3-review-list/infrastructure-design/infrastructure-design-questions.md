# Infrastructure Design Questions — U3 `u3-review-list`

U3 の NFR Design はすでに、新しい AWS のサービス・表・関数を作らない（既存の Review 関数と ReviewDecision・ReportListItem の表に処理と項目を足すだけ）と決めています。Infrastructure Design で新しく選ぶものは実質ありません。念のため、この前提のまま進めてよいかだけを確認します。

## Q1. [アーキテクト] 新しいインフラの決定は不要という前提の確認

U3 は、新しい DynamoDB の表・新しい Lambda 関数・新しい外部サービスを作りません。既存の `MonsterNote-Api-dev` スタックの Review 関数に API の道（却下・取り消し・絞り込み一覧）を足し、既存の `MonsterNote-Data-dev` スタックの表（ReviewDecision・ReportListItem）に項目を足すだけです。この前提のまま Infrastructure Design の文書を作成してよいですか。

- A. その前提でよい（新しいインフラの決定は不要）
- X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
