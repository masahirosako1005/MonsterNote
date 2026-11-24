# Security Requirements（セキュリティの要件）— U3 `u3-review-list`

入力: `construction/u1-skeleton/nfr-requirements/security-requirements.md`（U1 の NFR4.1〜NFR6.3。U3 はこれを引き継ぐ）、`construction/u3-review-list/functional-design/`（rules の BR3・BR4）、`inception/requirements-analysis/requirements.md`（NFR4・NFR5）、`inception/contract-design/contract-summary.md`（C3・C4）、nfr-requirements-questions.md（Q3）、project.md。

## 1. 認証と認可（U3 で足すもの）

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR4.10 | 却下・取り消しは依頼元だけができる（承認と同じ権限の確認）。取り消しは、さらに**操作した本人**だけに絞る | 単体試験（他人の依頼元が取り消そうとして 403） | NFR4、BR3.9 |
| NFR4.11 | 状態の読み出し（`GET /v1/reviews/{id}`）が返す `undoUntil` は、**操作した本人であり、かつ今の時刻が `undoUntil` 以前であるときにだけ**返す。ほかの依頼元には返さない。本人でも 10 秒の期限を過ぎたら返さない（画面にボタンを出させないため） | 単体試験（他人の依頼元の応答に `undoUntil` がないこと、本人でも期限切れ後は `undoUntil` がないこと） | NFR4、BR3.15、レビュー R-04 |
| NFR4.12 | 一覧の絞り込みの道（`GET /v1/catalog/reports`）は依頼元だけ。ハンターは 403（U1 の NFR4.3 と同じ確認を、絞り込みのパラメータがあっても行う） | 単体試験 | NFR4、BR4.2 |

## 2. データの保護（U3 で足すもの）

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR5.13 | 却下の理由の文（`reasonText`）は、画面で文字としてそのまま表示する（HTML として解釈しない。U1 の NFR5.6 と同じ考え方） | コードの検査（ESLint の規則）、E2E | NFR5、U1 の NFR5.6 |
| NFR5.14 | ログに却下の理由の文、確認した人の表示名を出さない（U1 の NFR5.5 に足す。表示名は画面には出すが、ログには出さない） | 単体試験（ログの出力に含まれないこと） | NFR5、U1 の NFR5.5 |

## 3. 脅威の考慮（U3 で足すもの）

| 脅威 | 手当て |
|---|---|
| 却下の理由の文に、画面を壊す文字列（スクリプトなど）を入れる | 文字としてそのまま表示する（NFR5.13） |
| 取り消しの期限が切れたあとに古い画面から取り消しを押す | サーバーが期限を確かめ、409 UNDO_EXPIRED（BR3.9） |
| ほかの依頼元の「取り消す」ボタンを操作で出す（画面を細工する） | サーバーが本人かどうかを必ず確かめる（BR3.9。画面を信用しない） |
| 却下の理由の文を極端に長くして保存を重くする | 1〜200 文字の確認（BR3.8） |
| 絞り込みの値に知らない文字列を入れて、裏側の挙動を探る | 知らない値は 400 で拒む（BR4.5） |

## Assumptions & Open Questions

- NFR5.13 は React の標準の表示（JSX の文字の差し込み）を使う限り自動的に守られる。生の HTML を差し込む書き方（`dangerouslySetInnerHTML` など）を使わないことを ESLint の規則で確かめる。 [assumption]
