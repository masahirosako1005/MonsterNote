# Observability Requirements（監視の要件）— U3 `u3-review-list`

入力: `construction/u1-skeleton/nfr-requirements/observability-requirements.md`（U1 の NFR10.6〜NFR11.6。U3 はこれを引き継ぐ）、performance-requirements.md・reliability-requirements.md（U3 の分）、`inception/requirements-analysis/requirements.md`（NFR10・NFR11・NFR14）、nfr-requirements-questions.md（Q4）。

## 1. ログ（U3 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.15 | 却下のたびに記録する: 報告の ID、理由、確認した人の accountId（表示名は出さない）、かかった時間 | Q4 |
| NFR11.16 | 取り消しのたびに記録する: 報告の ID、取り消した人の accountId、確定からの経過秒数 | Q4 |
| NFR11.17 | 同時の操作で弾かれたとき（409 ALREADY_DECIDED・409 ALREADY_UNDONE）は、`errorCode` とともに記録する。弾かれた人は呼び出した本人の認証情報の accountId で示す。**確認済みの人は、409 ALREADY_DECIDED では記録の decidedByAccountId から、409 ALREADY_UNDONE では（BR3.10 により取り消しの成功で記録から消えているため）呼び出した本人の認証情報の accountId から得る**（本人の二重送信なので、呼び出した人＝確認済みの人になる） | Q4、BR3.3・BR3.9・BR3.10、レビュー R-01 |
| NFR11.18 | 絞り込みの読み出しで上限（2,000 件）に当たったときは、`errorCode=FILTER_LIMIT_REACHED` として記録する | Q4、NFR3.6 |

## 2. 指標とアラーム（U3 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR10.24 | **アラームは U1 の 2 つのままにし、U3 で増やさない。** 却下・取り消し・同時の操作で弾かれた回数は、ログを必要なときに見て確かめる | Q4 |
| NFR10.25 | 必要なときに見る値（アラームは作らない）: 却下の件数、取り消しの件数、同時の操作で弾かれた回数、絞り込みの上限に当たった回数。CloudWatch Logs Insights でログから数える | Q4、U1 の NFR10.6 |

## 3. 監査の記録（U3 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR14.3 | U3 の Review・ReportCatalog は、操作の知らせ（`audit.recorded`）を送る。受け手（AuditLog）は U4 で作るため、U3 の時点では記録されない | NFR14、unit-of-work |
| NFR14.4 | U3 が送るのは、約束 C15 の `audit.recorded`（単一の知らせの形）で、`action` に `review.rejected`（却下）・`review.undone`（取り消し）を入れる。`review.rejected`・`review.undone` という名前の別々の知らせは作らない（`review.status-changed`〈C13〉とは別物）。承認は U1 ですでに同じ形で送っている | NFR14、components、contract-summary C15、レビュー R-03 |

## Assumptions & Open Questions

- NFR11.17 の「弾かれた人」は、API を呼んだが拒まれた人。記録には accountId だけを残し、表示名は入れない（U4 の AuditLog の決まりと合わせる）。 [assumption]
