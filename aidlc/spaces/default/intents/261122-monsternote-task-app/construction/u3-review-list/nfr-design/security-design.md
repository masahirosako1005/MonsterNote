# Security Design（セキュリティの設計）— U3 `u3-review-list`

入力: `construction/u3-review-list/nfr-requirements/security-requirements.md`（NFR4.10〜NFR5.14）、logical-components.md、`construction/u1-skeleton/nfr-design/security-design.md`（U1 の設計。ログイン・API の認可をここで引き継ぐ）、`construction/u3-review-list/functional-design/rules.md`（BR3.9・BR3.12・BR3.15・BR4.5）。

U1 のログイン・API の認可（Cognito の JWT、役割ごとの確認）は、そのまま U3 の API にも適用する。ここには U3 で足す分だけを書く。

## 1. 却下・取り消し・絞り込みの認可（NFR4.10〜NFR4.12）

| API | 確認する内容 | 実現の仕方 |
|---|---|---|
| 却下（`PUT /v1/reviews/{id}/decision`、decision=rejected） | 依頼元であること（承認と同じ） | U1 の承認と同じ役割の確認（JWT の role=requester） |
| 取り消し（`POST /v1/reviews/{id}/decision/undo`） | 依頼元であることに加え、**操作した本人**であること | BR3.9 の条件付き書き換えの中に `decidedByAccountId=操作する人` を条件式として組み込む（読んでから比べるのではなく、書き換えの条件そのものにする。アプリ層とデータ層で二重に確認する形にしない） |
| 絞り込み一覧（`GET /v1/catalog/reports`） | 依頼元であること | U1 の NFR4.3 と同じ役割の確認を、絞り込みのパラメータがあっても必ず行う（パラメータの有無で確認を迂回する経路を作らない） |

## 2. `undoUntil` の絞り込み（NFR4.11、BR3.15）

状態の読み出し（`GET /v1/reviews/{id}`）が `undoUntil` を応答に含めるかどうかは、**応答を組み立てる最後の段階で判定する**（データ層の読み出し自体は常に `undoUntil` を含めて返す。読み出す側の権限で項目を落とす設計）。

```
IF 読む人の accountId = ReviewDecision.decidedByAccountId AND 今の時刻 ≤ undoUntil
  THEN 応答に undoUntil を含める
  ELSE 応答の型から undoUntil を除く（null を返すのではなく、項目ごと無い形にする）
```

他人の依頼元や、期限切れの本人には `undoUntil` が存在しない応答を返すことで、画面はこの項目の有無だけでボタンの表示を判断でき、画面側に別途の期限確認ロジックを持たせない（BR3.15 の意図どおり、判断はサーバーに閉じる）。

## 3. データの保護（NFR5.13・NFR5.14）

| ID | 設計 |
|---|---|
| NFR5.13 | `reasonText`（却下の理由の文）は、画面の表示コンポーネントが React の標準の文字列差し込み（JSX）だけで描画する。`dangerouslySetInnerHTML` を使うコンポーネントの一覧にレビュー対象を限定する ESLint のルール（`react/no-danger`）を有効にし、CI で検査する |
| NFR5.14 | 共通のロガーの「出してよい項目」の型（U1 の NFR5.5 の実装）に、却下の理由の文（`reasonText`）と確認した人の表示名（`decidedByName`）を**含めない**。ログに残すのは `reportId`・`reason`（列挙値）・`decidedByAccountId` までとし、自由記述の文字列と表示名は型のレベルで受け取れないようにする |

## Assumptions & Open Questions

- `undoUntil` を応答の型から除く実装は、Code Generation で TypeScript の判別可能な型（`undoUntil` ありのレスポンス型／なしのレスポンス型）として表現し、`undefined` を代入するだけの実装ミスを防ぐ。 [assumption]
