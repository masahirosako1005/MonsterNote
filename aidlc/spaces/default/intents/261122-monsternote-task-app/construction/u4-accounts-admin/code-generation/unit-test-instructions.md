# Unit Test Instructions — U4 `u4-accounts-admin`

## テストの枠組み

- 単体・結合試験: Vitest（U1〜U3と同じ設定）
- 同時操作の試験: `Promise.all`で2つの無効化をほぼ同時に起動し、1回だけ成功することを確認する（NFR13.11）
- CDKの構成の試験: `aws-cdk-lib/assertions`
- E2E: Playwright（AWSなし）

## このUnitだけを動かすコマンド

```bash
npx vitest run backend/src/accounts backend/src/audit-log backend/src/shared/require-password-changed.u4.test.ts backend/src/handlers/accounts.u4.test.ts backend/src/handlers/audit-log.u4.test.ts
```

```bash
npx vitest run backend/src/catalog/delete-all.u4.test.ts backend/src/review/delete-all.u4.test.ts backend/src/duplicate-detection/delete-all.u4.test.ts backend/src/reporting/delete-all.u4.test.ts backend/src/handlers/settings.u4.test.ts
```

```bash
npx vitest run frontend --project frontend
```

```bash
npx vitest run infra/test/stacks.u4.test.ts
```

```bash
npx playwright test e2e/u4-accounts-admin.spec.ts
```

## 期待するカバレッジ

- `feature`スコープの下限どおり行カバレッジ**80%以上**（CDKのコードは対象外）。Build and Testがプロジェクト全体で確認する

## モック・スタブの方針

- DynamoDB: DynamoDB Local
- Cognito: `@aws-sdk/client-cognito-identity-provider`のモック（`AdminCreateUserCommand`・`AdminSetUserPasswordCommand`・`AdminAddUserToGroupCommand`・`UsernameExistsException`のケースを含む）
- EventBridge: U1〜U3と同じモック
- S3: 既存の`reporting`のモックを再利用（削除は`DeleteObjectsCommand`）

## テストデータ

- 既存の`backend/test/helpers/reporting.ts`・`backend/test/helpers/events.ts`・`backend/test/helpers/jwt.ts`を再利用する
- 管理者ロールのJWTフィクスチャを追加する
- 削除のバッチ境界試験用に、26件以上のダミーレコードを作るヘルパーを追加する

## 重要な制約（計画からの逸脱を避けるため）

- `loginId`の一意性はCognito側の`UsernameExistsException`だけで保証する。DynamoDB側に一意性確認の仕組み（条件付き書き込み・ロック項目）を追加しないこと（reliability-design.md §1）
- `accounts`関数のIAMに`AdminUpdateUserAttributes`・`AdminDisableUser`は追加しないこと（無効化・有効化はDynamoDB側だけで行う）
- `catalog`・`review`・`duplicate-detection`・`reporting`の4関数のメモリは変更しないこと（timeoutだけ15秒に統一）
