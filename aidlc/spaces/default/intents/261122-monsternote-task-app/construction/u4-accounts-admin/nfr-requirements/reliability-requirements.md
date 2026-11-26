# Reliability Requirements（信頼性の要件）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/nfr-requirements/reliability-requirements.md`（U1 の NFR10.1〜NFR11.3。U4 はこれを引き継ぐ）、`construction/u4-accounts-admin/functional-design/`（rules の BR11・BR12・BR13）、`inception/requirements-analysis/requirements.md`（NFR10・NFR11）、nfr-requirements-questions.md（Q3）。

## 1. アカウントの操作の確かさ

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR10.26 | アカウントの作成・無効化・有効化は、すべて条件にした 1 回の書き換えで行う（ID の重なりの確認、AdminCounter の増減を含む）。同時に呼ばれても矛盾した結果にならない | 単体試験（同時に呼んで 1 回だけ成功することを確かめる） | BR11.2・BR11.9、U3・U4 のレビュー R-01・R-02・R-07 |
| NFR10.27 | AdminCounter の整合性は、管理者がアカウントの一覧を開いたときに数え直して直す（独自の監視やアラームは設けない。機能設計の決定どおり） | 単体試験 | BR11.9、Q3 |

## 2. 「すべて削除」の確かさ

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR10.28 | 「すべて削除」の 5 つの入口は、それぞれが**独立して何度呼んでも同じ結果**になる（BR13.1）。途中で失敗しても、その入口からやり直せる | 単体試験、E2E | BR13.1 |
| NFR10.29 | 5 つの入口がすべて終わったあと、報告と一覧の件数を数え直し、0 件でなければやり直しを促す（削除の最中に新しい報告が届いた場合への備え） | 単体試験 | BR13.1、U4 のレビュー R-05 |
| NFR10.30 | 削除の実行中に知らせ（`report.saved` など）が届いても、データを壊さない。遅れて届いた知らせで行が作り直されることはあるが、同じ順でもう一度削除すれば解消する | 単体試験 | BR13.1 |

## 3. 保存期間（U4 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.19 | 操作の記録（AuditEntry）は、書き換えず・削除せず、試験運用そのものを終えるとき（AWS の環境を片方付ける）まで保存する | NFR11、BR12.4 |
| NFR11.20 | アカウントは「すべて削除」の対象に含めない（無効化で扱う。U1 の components の整理のとおり） | NFR11、BR13.3 |

## Assumptions & Open Questions

- NFR10.26 は、U1（承認）・U2（重複の判定）・U3（確認の操作）に続き、U4 でも「条件にした 1 回の書き換え」を徹底する。U4 のレビューで同じ誤り（数えてから書く）が 2 回見つかった経緯があるため、Code Generation で特に注意する。 [assumption]
