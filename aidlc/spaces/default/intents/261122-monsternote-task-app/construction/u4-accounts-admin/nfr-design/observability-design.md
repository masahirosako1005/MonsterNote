# Observability Design（監視の設計）— U4 `u4-accounts-admin`

入力: `construction/u4-accounts-admin/nfr-requirements/observability-requirements.md`（NFR10.31〜NFR14.7）、`construction/u1-skeleton/nfr-design/observability-design.md`（U1 の設計。ログの形・アラームをここで引き継ぐ）、nfr-design-questions.md（Q4）。

U1 のログの形とアラーム 2 つをそのまま使う。U4 でアラームは増やさない（NFR10.31、Q4-A）。

## 1. ログの項目（U4 で足すもの）

| 場面 | 記録する項目 |
|---|---|
| アカウントの作成・無効化・有効化・パスワードの再設定 | `targetAccountId`、操作した管理者の `accountId`、操作の種類、結果（成功・失敗）。仮のパスワードは出さない（NFR11.21） |
| 管理者の無効化が拒まれた | `errorCode`（`CANNOT_DISABLE_SELF`・`LAST_ADMIN`）、対象の `accountId`（NFR11.22） |
| 「すべて削除」の実行 | 部品ごとの `componentName`、消した件数、かかった時間（`durationMs`）。失敗時は失敗した部品と `errorReason`（NFR11.23） |
| 設定の変更 | 変えた管理者の `accountId`。変更の前後の値は出さない（NFR11.24） |

## 2. 必要なときに見る値（アラームは作らない。NFR10.32、Q4-A）

U2・U3 と同じ形で、CloudWatch Logs Insights のクエリ例を保存しておく（Infrastructure Design で保存）:

```
fields @timestamp, componentName, deletedCount, durationMs
| filter ispresent(componentName) and @message like /すべて削除|data\.deleted/
| stats sum(deletedCount) as total, max(durationMs) by componentName
```

```
fields @timestamp, errorCode, accountId
| filter errorCode = "CANNOT_DISABLE_SELF" or errorCode = "LAST_ADMIN"
| stats count() by errorCode
```

- アカウントの作成・無効化の件数
- 管理者の無効化が拒まれた回数（`errorCode` ごと）
- 「すべて削除」の実行回数と、部品ごとの結果（成功・失敗、消した件数）
- 設定の変更の回数

Q4 では「そのまま踏襲する（A）」を選んだため、削除の実行結果を一覧する追加のクエリは、上の「すべて削除」のクエリ例に含める形にとどめ、別立てにしない。

## 3. 監査の記録（U4 で足すもの。NFR14.5〜NFR14.7）

| ID | 設計 |
|---|---|
| NFR14.5 | AuditLog 関数が `audit.recorded` を受けて `AuditEntry` を作る受け手になる（reliability-design.md §2）。U1〜U3 がすでに送っていた知らせは、ここで初めて記録として残る |
| NFR14.6 | `audit.recorded` の `action` の値: `account.created`・`account.disabled`・`account.enabled`・`account.password-reset`（アカウント）、`settings.updated`（設定）、`data.deleted`（削除、部品ごとに 1 件ずつ送る）。`account.enabled` は無効化（`account.disabled`）と対になる操作として同じ扱いにする（レビュー R-03 の確認どおり） |
| NFR14.7 | 操作の記録の一覧（`GET /v1/admin/audit-entries`）は、新しい順・50 件・ページ分け（U1 の一覧の決まりと同じ作り。performance-design.md §1） |

## Assumptions & Open Questions

- Code Generation の時点で、U1〜U3 の各部品が実際に `audit.recorded` を送っているかを確かめる（nfr-requirements の Assumptions のとおり、送っていなければ足す）。 [assumption]
