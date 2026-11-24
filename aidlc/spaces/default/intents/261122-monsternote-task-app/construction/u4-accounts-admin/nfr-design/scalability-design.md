# Scalability Design（規模の設計）— U4 `u4-accounts-admin`

入力: `construction/u4-accounts-admin/nfr-requirements/scalability-requirements.md`（NFR1.7、NFR3.8〜NFR3.10、NFR12.10〜NFR12.11）、logical-components.md、nfr-design-questions.md（Q1・Q2）。

U4 は新しい AWS のサービスを作らない（Q1-A。AuditLog の関数以外は既存の関数の拡張）。新しく増える表は `AuditEntry`・`AdminCounter` の 2 つ。

## 1. 規模（NFR3.8〜NFR3.10）

| 項目 | 見込み |
|---|---|
| 利用者 | 20 人以下、管理者は数人 |
| 操作の記録（月間） | 約 300 件（報告の操作 + アカウント・設定の操作） |
| 「すべて削除」の対象件数（累計） | 数百件（設計の計画の目安は performance-design のとおり最大 1,000 件） |

`AuditEntry`・`AdminCounter` はどちらも DynamoDB オンデマンドで、この規模は無料枠（25 GB・月 100 万回の読み書き）を大きく下回る。

## 2. 関数のメモリと運用の制約（NFR12.10）

| 関数 | メモリ |
|---|---|
| Accounts（アカウント管理を含む） | 128 MB（U1 のまま。Cognito の呼び出しと小さな書き込みだけ） |
| AuditLog（新規） | 128 MB（受け取った知らせを 1 件書き込むだけ） |
| Review・Reporting・DuplicateDetection（削除の入口を含む） | 既存のメモリ（Review 128 MB、Reporting 256 MB、DuplicateDetection 256 MB）を変えない。削除の `BatchWriteItem` のループはメモリよりも時間が支配的なため（performance-design のとおり、時間切れを 15 秒に引き上げる） |

## 3. 自動削除の設定（NFR12.11）

`AuditEntry` の表には TTL を設定しない（NFR11.19 のとおり、試験運用そのものを終えるまで保存する。`RemovalPolicy: RETAIN`）。

## 4. 費用（NFR1.7）

U4 が新しく生む費用は、`AuditEntry`・`AdminCounter` の表と、AuditLog 関数・削除の入口の呼び出し回数の増加だけ。いずれも月数百回規模で、DynamoDB オンデマンド・Lambda の無料枠（月 100 万回）の中に収まり、追加の費用は 0 円の見込み（nfr-requirements のとおり）。

## Assumptions & Open Questions

- 試験運用の実際の累計件数が設計の目安（1,000 件）を大きく超えた場合は、performance-design の Assumptions のとおり、削除の方式（Q2-B）や関数の時間切れの見直しを検討する。 [assumption]
