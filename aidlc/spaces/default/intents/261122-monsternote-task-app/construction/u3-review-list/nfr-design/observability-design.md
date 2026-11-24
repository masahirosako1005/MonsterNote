# Observability Design（監視の設計）— U3 `u3-review-list`

入力: `construction/u3-review-list/nfr-requirements/observability-requirements.md`（NFR10.24〜NFR10.25、NFR11.15〜NFR11.18、NFR14.3〜NFR14.4）、`construction/u1-skeleton/nfr-design/observability-design.md`（U1 の設計。ログの形・アラームをここで引き継ぐ）、nfr-design-questions.md（Q3）。

U1 のログの形（JSON、共通のロガー）とアラーム 2 つ（API の 5xx、関数のエラー）をそのまま使う。U3 でアラームは増やさない（NFR10.24、Q3-A）。

## 1. ログの項目（U3 で足すもの）

| 場面 | 記録する項目 |
|---|---|
| 却下 | `reportId`、`reason`、確認した人の `accountId`、かかった時間（`durationMs`）。理由の文（`reasonText`）・表示名は出さない（NFR5.14） |
| 取り消し | `reportId`、取り消した人の `accountId`、確定からの経過秒数、`eventSent`（知らせの送信が 1 回で成功したか） |
| 取り消しの知らせの送信失敗 | `reportId`、`errorCode=EVENT_PUBLISH_FAILED`（reliability-design.md §2 の受け入れたリスク。一覧の該当行が古いまま残りうることの手がかりにする） |
| 同時の操作で弾かれた（409） | `errorCode`（`ALREADY_DECIDED`・`ALREADY_UNDONE`・`UNDO_EXPIRED`）、呼び出した本人の `accountId`、確認済みの人の `accountId`（409 ALREADY_DECIDED は記録の `decidedByAccountId` から、409 ALREADY_UNDONE は呼び出した本人の `accountId` から。NFR11.17） |
| 絞り込みの上限超過 | `errorCode=FILTER_LIMIT_REACHED`、絞り込みの条件（`status`・`flag`） |

## 2. 必要なときに見る値（アラームは作らない。NFR10.25、Q3-A）

U2 と同じ形で、CloudWatch Logs Insights のクエリ例を保存しておく（Infrastructure Design で保存）:

```
fields @timestamp, reportId, reason
| filter ispresent(reason) and @message like /却下|rejected/
| stats count() by reason
```

```
fields @timestamp, errorCode, accountId
| filter errorCode = "ALREADY_DECIDED" or errorCode = "ALREADY_UNDONE" or errorCode = "UNDO_EXPIRED"
| stats count() by errorCode
```

- 却下の件数・理由の内訳
- 取り消しの件数
- 同時の操作で弾かれた回数（`errorCode` ごと）
- 絞り込みの上限（2,000 件）に当たった回数

Q3 では「そのまま踏襲する（A）」を選んだため、試験運用の期間中の手動集計用の追加クエリ（却下理由の内訳など）は別立てにせず、上のクエリ例に含める形にとどめる。

## 3. 監査の記録（U3 で足すもの。NFR14.3〜NFR14.4）

| ID | 設計 |
|---|---|
| NFR14.3 | Review・ReportCatalog は、操作のたびに `audit.recorded`（C15）を送る。受け手（AuditLog）は U4 で作るため、U3 の時点では記録されない |
| NFR14.4 | `audit.recorded` の `action` に `review.rejected`（却下）・`review.undone`（取り消し）を入れる。承認は U1 ですでに同じ形で送っている。`review.status-changed`（C13）とは別の知らせであり、混同しない |

## Assumptions & Open Questions

- U1 のアラーム（関数のエラー、5 分間で 3 回以上）は、全関数の `Errors` の合計を見る作りのため、U3 で足す処理（却下・取り消しは `review` 関数、絞り込み一覧は `catalog` 関数。logical-components.md の訂正のとおり、2 つの既存の関数に分かれる）のどちらも、個別の設定なしに対象へ入る。 [assumption]
