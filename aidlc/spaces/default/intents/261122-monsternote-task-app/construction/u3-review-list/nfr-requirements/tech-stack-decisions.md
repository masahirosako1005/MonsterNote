# Tech Stack Decisions（技術の選択）— U3 `u3-review-list`

入力: `construction/u1-skeleton/nfr-requirements/tech-stack-decisions.md`（U1 で決めた技術の選択。**U2〜U4 も同じ**と明記されている）、`construction/u3-review-list/functional-design/`（functional-spec・rules）、nfr-requirements-questions.md（Q1〜Q4）。

U1・U2 で決めた技術をそのまま使う。**U3 で新しく選ぶものはない**（新しい AWS のサービス・新しいライブラリ・新しいデータベースの表を増やさない）。

## 1. U3 での使い方の補い

| 分野 | 使い方 | 理由 | 出典 |
|---|---|---|---|
| DynamoDB の条件付き書き込み | 承認・却下・取り消しのすべてで、`ConditionExpression` を使った 1 回の書き換えにする（読んでから書く形にしない） | U3 のレビューで「数えてから書く」形の誤りが見つかり、直した経緯がある（R-01）。同時の操作を正しく捌く唯一の方法 | 機能設計のレビュー R-01、NFR10.21 |
| 時刻の扱い | `undoUntil` はサーバーが計算した絶対時刻（ISO 8601）で返す。画面は相対時間に変換するだけで、絶対時刻の計算はサーバーだけが行う | 画面の時計のずれに影響されないため（Q2） | NFR7.5 |

## 2. U1 から引き継ぐ品質の要件

U1 の NFR13.1〜NFR13.4（行カバレッジ 80% 以上、TDD、CI、`npm run verify`）は U3 でもそのまま。U3 で足す試験の観点:

| ID | 要件 | 出典 |
|---|---|---|
| NFR13.9 | 同時の操作の試験は、2 つの書き換えをほぼ同時に起動して、1 回だけ成功することを確かめる（Vitest で Promise を並べて起動） | NFR10.21 |
| NFR13.10 | 取り消しの期限の試験は、`vi.useFakeTimers()` で時刻を進めて確かめる（U1 の決まりと同じ） | U1 の tech-stack-decisions |

## Assumptions & Open Questions

- 特になし。U3 は技術の選択を増やさない Unit。
