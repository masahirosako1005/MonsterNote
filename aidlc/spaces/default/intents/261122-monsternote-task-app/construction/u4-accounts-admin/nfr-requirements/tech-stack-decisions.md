# Tech Stack Decisions（技術の選択）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/nfr-requirements/tech-stack-decisions.md`（U1 で決めた技術の選択。**U2〜U4 も同じ**と明記されている）、`construction/u4-accounts-admin/functional-design/`（entities・functional-spec・rules）、nfr-requirements-questions.md（Q1〜Q5）。

U1〜U3 で決めた技術をそのまま使う。**U4 で新しい AWS のサービスは選ばない**。新しく増えるのはデータベースの表（AuditEntry・AdminCounter）と、それに伴う関数。

## 1. U4 で新しく選ぶもの

| 分野 | 選んだもの | 理由 | 選ばなかったもの | 出典 |
|---|---|---|---|---|
| 操作の記録の保存 | DynamoDB の表（`AuditEntry`）。既存の選択と同じ（オンデマンド、既定の暗号化） | AuditLog の持ち主（components.md）。知らせから作る他の表と同じ作り方 | — | functional-design |
| 管理者の数の保存 | DynamoDB の表（`AdminCounter`）。1 行だけ持つ | 条件付き書き込みで同時実行を正しく捌くための、専用の小さな記録 | Account の一覧を毎回数える（読む量が増え、同時実行を正しく捌けない） | functional-design レビュー R-02・R-07 |
| 最初の管理者の作成 | U1 のスクリプト（`scripts/create-account.ts`）に `admin` の役割を足す | U1 のスクリプトの仕組み（Cognito の `AdminCreateUser`・`AdminSetUserPassword`）をそのまま使える | 管理者の画面からの作成だけにする（最初の 1 人を誰も作れない。機能設計の Q1） | 機能設計の Q1 |

## 2. U1 から引き継ぐ品質の要件

U1 の NFR13.1〜NFR13.4（行カバレッジ 80% 以上、TDD、CI、`npm run verify`）は U4 でもそのまま。U4 で足す試験の観点:

| ID | 要件 | 出典 |
|---|---|---|
| NFR13.11 | AdminCounter の条件付き書き込みの試験は、同時に 2 つの無効化を起動して 1 回だけ成功することを確かめる（U3 の NFR13.9 と同じ作り方） | NFR10.26 |
| NFR13.12 | 「すべて削除」の試験は、5 つの入口をそれぞれ 2 回呼んで、2 回目が 0 件で成功することを確かめる（何度呼んでも同じ結果） | BR13.1 |
| NFR13.13 | 最初の管理者を作るスクリプトの試験は、U1 の `create-account.u1.test.ts` に `--role admin` のケースを足す形で行う | 機能設計の Q1 |

## Assumptions & Open Questions

- 特になし。U4 は U1〜U3 の技術の選択をそのまま使う、最後の Unit。
