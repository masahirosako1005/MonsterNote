# Performance Requirements（性能と画面の要件）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/nfr-requirements/performance-requirements.md`（U1 の NFR2.1〜NFR9.2。U4 はこれを引き継ぐ）、`construction/u4-accounts-admin/functional-design/`（functional-spec・rules・frontend-components）、`inception/requirements-analysis/requirements.md`（NFR2・NFR7・NFR9）、nfr-requirements-questions.md（Q1〜Q5）。

前提の規模: 利用者 20 人以下、管理者は数人を見込む（NFR3）。U1 で決めた応答時間（一覧・詳細 3 秒）は、操作の記録の一覧にも同じ目標を当てる（Q4）。

## 1. 応答時間（U4 で足すもの）

| ID | 要件 | 測り方 | 出典 |
|---|---|---|---|
| NFR2.15 | アカウントの一覧（`GET /v1/admin/accounts`）は、95% のリクエストで 3 秒以内（利用者 20 人以下の規模では数十件） | API Gateway の Latency の p95 | NFR2 |
| NFR2.16 | アカウントの作成・パスワードの再設定（`POST /v1/admin/accounts`・`.../password-reset`）は、95% のリクエストで 3 秒以内（AdminCounter の条件付き書き換えを含む） | 同上 | NFR2、BR11.2・BR11.3 |
| NFR2.17 | 操作の記録の一覧（`GET /v1/admin/audit-entries`）は、95% のリクエストで **3 秒以内**（U1 の一覧と同じ目標） | 同上 | NFR2、Q4 |
| NFR2.18 | 「すべて削除」の 5 つの入口は、それぞれ 95% のリクエストで 10 秒以内（U1 の送信の予算と同じ。件数は試験運用の規模で数百件） | 同上 | NFR2、BR13.1 |

## 2. 画面の要件（U4 で足すもの）

| ID | 要件 | 測り方 | 出典 |
|---|---|---|---|
| NFR7.8 | 仮のパスワードの表示は、区切り（4 文字ごとにハイフンなど）を入れて読み上げやすくする。文字は 20px 以上 | E2E（表示の確認） | NFR7、frontend-components |
| NFR7.9 | 「すべて削除」の確認画面は、件数を大きく表示し、「削除する」のボタンは「やめる」よりも目立たせない（押し間違いを防ぐ） | E2E、frontend-components | NFR7、BR13.2 |
| NFR7.10 | 削除の進み具合の画面は、5 つの部品それぞれの状態（待ち・実行中・終わった・失敗）を文字とアイコンで示す | E2E | NFR7、frontend-components |
| NFR9.5 | **管理者の画面（AdminApp）が対応する機器は、パソコンの Chrome・Edge（最新版）とする。** U1 の NFR9.1 はハンター・依頼元の機器を定めているが、管理者の画面はこれまで定めていなかった（U4 で AdminApp を新設したため）。管理者はパソコンでの利用を前提とし、スマホは対象外とする | E2E（Playwright、対応するブラウザで実機相当の確認） | NFR9、レビュー R-01 |

## Assumptions & Open Questions

- NFR2.18 の 10 秒は、各部品の削除が内部で行う処理（DynamoDB の削除、S3 のオブジェクトの削除）の見込みから、U1 の送信の予算と同じ値を当てた。dev で実測し、件数が増えたときは部品ごとにページ分けして複数回呼ぶ形に変える。 [assumption]
- NFR9.5 でスマホを対象外にしたのは、管理者の操作（アカウントの作成・削除の実行など）が小さい画面では誤操作の危険が増えるため。試験運用の管理者は 1〜数人で、パソコンでの利用を想定している。 [assumption]
