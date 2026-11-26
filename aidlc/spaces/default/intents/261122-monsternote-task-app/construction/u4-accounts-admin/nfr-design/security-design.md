# Security Design（セキュリティの設計）— U4 `u4-accounts-admin`

入力: `construction/u4-accounts-admin/nfr-requirements/security-requirements.md`（NFR4.13〜NFR5.17）、logical-components.md、`construction/u1-skeleton/nfr-design/security-design.md`（U1 の設計。ログイン・API の認可をここで引き継ぐ）、`construction/u4-accounts-admin/functional-design/rules.md`（BR11.1・BR11.4・BR11.9、BR13.3）。

## 1. 管理者の道の認可（NFR4.13・NFR4.15・NFR4.17）

| API | 確認する内容 |
|---|---|
| `/v1/admin/...` のすべて（アカウント管理・削除・設定の変更） | role=admin の JWT だけを受け付ける（U1 の NFR4.3 の確認をこの道に適用。BR11.1） |
| ログイン直後の全操作 | `mustChangePassword=true` のあいだは `PUT /v1/me/password`・`GET /v1/me` 以外のすべての API を拒む（BR11.4）。この確認は API Gateway の認可（JWT の役割）とは別の、アプリ層の確認として、認可の判定の入口（ミドルウェア）に 1 箇所にまとめる（U1〜U3 のハンドラに個別実装しない） |
| 5 つの削除の入口 | role=admin であれば誰でも実行できる（階層を設けない。NFR4.17） |

## 2. 自分自身・最後の管理者の無効化の防止（NFR4.14、BR11.9）

```
IF 対象の accountId = 操作する人の accountId
  THEN 422 CANNOT_DISABLE_SELF（画面はボタン自体を出さない。Q5 の AC どおり）
ELSE IF 無効化の TransactWriteItems が AdminCounter の条件（activeAdminCount ≥ 2）で失敗
  THEN 422 LAST_ADMIN
```

「自分自身」の確認はアプリ層の単純な比較（JWT の accountId と対象の accountId）で足り、DynamoDB の条件式には含めない。「最後の 1 人」の確認は、reliability-design.md の `TransactWriteItems` の条件式（`activeAdminCount >= :two`）で行う（読んでから判定しない）。

## 3. データの保護（NFR5.15〜NFR5.17）

| ID | 設計 |
|---|---|
| NFR5.15 | 仮のパスワードは、API の応答オブジェクトにだけ 1 回入れる専用の型（例: `AccountCreatedResponse.temporaryPassword`）を作り、ログ出力・監査の記録（AuditEntry）の組み立てに使う型には、この項目を**型のレベルで持たせない**（コードの構造で、記録の組み立て関数が仮のパスワードを参照できないようにする） |
| NFR5.16 | AuditEntry への書き込みを行うのは AuditLog 関数だけで、受け取る `audit.recorded` の `detail` に、パスワード・写真・報告の中身・却下の理由の文を**そもそも載せない**ことを、各部品（送信元）の責務にする（AuditLog 側でのフィルタではなく、約束 C15 を守る送信元の側で防ぐ。U2・U3 のレビューで固めた「送信元が絞り込む」設計と合わせる） |
| NFR5.17 | 操作した人の表示（`actorName`）は、知らせ（`audit.recorded`）に送信元が載せる（U3 の `decidedByName` と同じ考え方）。AuditLog は `accountId` を受け取って ID 判定を行うことはなく、表示名をそのまま記録する |

## 4. 秘密情報（U1 からの引き継ぎ）

最初の管理者を作るスクリプトは、U1 のスクリプト（開発者の手元の AWS 認証情報を使う、仮のパスワードは画面に 1 回だけ表示する）に `--role admin` を足すだけで、秘密情報の扱いの設計は変えない。

## Assumptions & Open Questions

- `mustChangePassword=true` のあいだの確認は、API Gateway の Lambda オーソライザーではなく、各関数のハンドラの入口にある共通のミドルウェアで行う（JWT の役割の確認と層を分ける）。 [assumption]
