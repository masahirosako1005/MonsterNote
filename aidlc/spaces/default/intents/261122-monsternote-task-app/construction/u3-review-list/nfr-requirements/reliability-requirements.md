# Reliability Requirements（信頼性の要件）— U3 `u3-review-list`

入力: `construction/u1-skeleton/nfr-requirements/reliability-requirements.md`（U1 の NFR10.1〜NFR11.3。U3 はこれを引き継ぐ）、`construction/u3-review-list/functional-design/`（rules の BR3・BR4）、`inception/requirements-analysis/requirements.md`（NFR10・NFR11）、`inception/contract-design/contract-summary.md`（2.5 順番）、nfr-requirements-questions.md（Q2・Q3）。

## 1. 同時の操作の確かさ

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR10.21 | **承認・却下・取り消しは、すべて条件にした 1 回の書き換えで行う。** 2 人が同時に操作しても、どちらか一方だけが成功する（読んでから書く形にしない） | 単体試験（同時に 2 回呼んで 1 回だけ成功することを確かめる） | BR3.3・BR3.9、U3 のレビュー R-01 |
| NFR10.22 | 書き換えが成功しなかった操作からは、状態の知らせ（`review.status-changed`）を送らない（1 回の状態の変化につき知らせは 1 回） | 単体試験 | BR3.13 |

## 2. 知らせの順番

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR10.23 | 重複の疑いの知らせ（`duplicate.suspected`）が一覧の行の保存の知らせ（`report.saved`）より先に届いても、印だけを先に覚え、保存の知らせが届いたときに一覧に出す（U1 の仕組みと同じ組み立て方） | 単体試験 | BR4.6、contract-summary 2.5 |

## 3. 保存期間（U3 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.14 | 却下の理由・取り消しの記録は、ReviewDecision の一部として、報告と同じく試験運用が終わるまで保存する | NFR11、FR10.2 |

## Assumptions & Open Questions

- NFR10.21 は、U1（承認）・U2（重複の判定の索引）・U3（却下・取り消し）に共通する作り方。U4 のレビューで「数えてから書く」形の誤りが 2 回見つかったため、U3 の Code Generation でもこの作り方を必ず確かめる。 [assumption]
