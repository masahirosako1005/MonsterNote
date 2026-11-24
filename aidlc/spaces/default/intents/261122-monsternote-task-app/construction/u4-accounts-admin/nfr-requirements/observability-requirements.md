# Observability Requirements（監視の要件）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/nfr-requirements/observability-requirements.md`（U1 の NFR10.6〜NFR11.6。U4 はこれを引き継ぐ）、performance-requirements.md・reliability-requirements.md・security-requirements.md（U4 の分）、`inception/requirements-analysis/requirements.md`（NFR10・NFR11・NFR14）、nfr-requirements-questions.md（Q5）。

## 1. ログ（U4 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.21 | アカウントの作成・無効化・有効化・パスワードの再設定のたびに記録する: 対象の accountId、操作した管理者の accountId、操作の種類、結果。**仮のパスワードそのものは記録しない** | Q5、NFR5.15 |
| NFR11.22 | 管理者の無効化が拒まれたとき（自分自身・最後の 1 人）は、`errorCode`（CANNOT_DISABLE_SELF・LAST_ADMIN）とともに記録する | Q5、BR11.9 |
| NFR11.23 | 「すべて削除」の実行のたびに、部品ごとに消した件数とかかった時間を記録する。途中で失敗したときは、失敗した部品と理由を記録する | Q5、BR13.1・BR13.4 |
| NFR11.24 | 設定の変更（重複の基準・対象地域）のたびに、変えた管理者の accountId を記録する。変更の前後の値は記録しない（Q6 の決定のとおり） | Q5、BR9.4 |

## 2. 指標とアラーム（U4 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR10.31 | **アラームは U1 の 2 つのままにし、U4 で増やさない。** アカウントの操作・削除の実行・設定の変更は、ログを必要なときに見て確かめる | Q5 |
| NFR10.32 | 必要なときに見る値（アラームは作らない）: アカウントの作成・無効化の件数、管理者の無効化が拒まれた回数、「すべて削除」の実行回数と結果、設定の変更の回数。CloudWatch Logs Insights でログから数える | Q5、U1 の NFR10.6 |

## 3. 監査の記録（U4 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR14.5 | U4 で AuditLog の受け手ができる。U1〜U3 の部品が送っていた `audit.recorded` の知らせが、ここで初めて記録として残る（unit-of-work のとおり） | NFR14、unit-of-work |
| NFR14.6 | U4 自身が送る知らせ（`audit.recorded`、C15）: アカウントの作成・無効化・有効化・パスワードの再設定（`account.*`）、設定の変更（`settings.updated`）、データの削除（`data.deleted`）。`action` の値は components.md の呼び名に合わせる。**有効化（account.enabled）は BR12.5 の文には名前が出ていないが、無効化と対になる操作として同じ扱いにする**（レビュー R-03） | NFR14、BR12.5、BR11.9 |
| NFR14.7 | 操作の記録の一覧（`GET /v1/admin/audit-entries`）は、新しい順・50 件・ページ分け（U1 の一覧の決まりと同じ作り） | NFR14、BR12.1 |

## Assumptions & Open Questions

- U1〜U3 がすでに送っている `audit.recorded` の知らせ（U1 の観察日誌に「送っていない」と残っているものを含む）は、U4 の Code Generation の時点で実際に送られているかを確かめ、送られていなければ足す。 [assumption]
- NFR14.6 の `action` の値（`account.created` など）は、U2・U3 の NFR14 で見つかった曖昧さ（レビュー R-03）と同じ形にそろえる。約束 C15 の `audit.recorded` の `action` に文字列として入れる。 [assumption]
