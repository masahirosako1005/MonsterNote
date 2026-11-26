# Scalability Requirements（規模・費用・運用の制約）— U3 `u3-review-list`

入力: `construction/u1-skeleton/nfr-requirements/scalability-requirements.md`（U1 の NFR1.1〜NFR3.2・NFR12.1〜NFR12.4。U3 はこれを引き継ぐ）、`construction/u3-review-list/functional-design/`（rules の BR4）、`inception/requirements-analysis/requirements.md`（NFR1・NFR3・NFR12）、nfr-requirements-questions.md（Q1）、project.md。

U3 は新しい AWS のサービスを使わない（DynamoDB・Lambda・API Gateway は U1 のまま）。費用への影響は、読み出しの回数が増える分だけ。

## 1. 規模（U3 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR3.6 | 絞り込みを掛けた一覧で読む行は、1 回につき最大 2,000 件（機能設計の Q1）。試験運用の規模（月 50 件未満）では、この上限に届かない | NFR3、BR4.7 |
| NFR3.7 | 取り消しは、承認・却下の 10 秒以内に限られる操作で、試験運用の規模（月 50 件未満）では 1 日あたり多くて数件を見込む | NFR3 |

## 2. 費用（U3 で足すもの）

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR1.6 | U3 が新しく使うのは DynamoDB の読み出しの増加だけ（絞り込みで多めに読む分）。MonsterNote の全体で月 100 円以内に収まる | 下の表、タグ別の費用の確認 | NFR1、Q1 |

U3 が新しく使う分の費用の見込み（試験運用の規模）:

| サービス | 使う量の見込み | 無料枠 | 見込み |
|---|---|---|---|
| DynamoDB（絞り込みの読み出し） | 月 数千回（U1・U2 の分に上乗せ） | 25 GB・読み書きの単位は 100 万回で約 0.25 ドル程度（常に無料枠あり） | 0〜数円 |
| **U3 の追加分の合計** | | | **0 円** |

新しい関数・新しいデータベースの表は作らない（U1 の `ReviewDecision`・`ReportListItem` に項目を足すだけ）。

## 3. 運用の制約（U3 で足すもの）

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR12.9 | 絞り込みの読み出しの関数は、U1 と同じメモリ（128〜256 MB）の範囲を守る。**dev の実測で性能の目標（NFR2.12 の 3 秒）を割り込んだときは、まずこの関数のメモリを 256 MB まで引き上げて様子を見る**（機能は変えない対処を先に試す。U1 の NFR12.2 の「重い処理は 256 MB」の例外をここにも当てる）。それでも届かないときに限り、読む上限（2,000 件）を下げる（NFR2.12。こちらは BR4.7・BR4.8 の挙動を変える） | CDK の構成の試験、dev での計測 | NFR12、project.md、レビュー R-02 |

## Assumptions & Open Questions

- 絞り込みの読み出しが将来、件数の増加で遅くなったときは、状態・印ごとの索引を足す選択肢がある（機能設計の Q1 の B）。試験運用の規模では不要。 [assumption]
