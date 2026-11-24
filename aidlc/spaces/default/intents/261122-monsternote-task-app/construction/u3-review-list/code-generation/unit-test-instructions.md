# Unit Test Instructions — U3 `u3-review-list`

## テストの枠組み

- 単体・結合試験: Vitest（U1 と同じ設定）
- 同時操作の試験: `Promise.all` で2つの書き換えをほぼ同時に起動し、1回だけ成功することを確認する（NFR13.9）
- 期限の試験: `vi.useFakeTimers()` で時刻を進めて `undoUntil` の判定を確認する（NFR13.10）
- CDK の構成の試験: `aws-cdk-lib/assertions`
- E2E: Playwright（AWS なし）

## このUnitだけを動かすコマンド

```bash
npx vitest run backend/src/review backend/src/catalog backend/src/handlers/review.u3.test.ts backend/src/handlers/catalog.u3.test.ts
```

```bash
npx vitest run frontend/requester/src frontend/ui-kit/src/components/UndoButton.u3.test.tsx --project frontend
```

```bash
npx vitest run infra/test/stacks.u3.test.ts
```

```bash
npx playwright test e2e/u3-reject-undo-filter.spec.ts
```

## 期待するカバレッジ

- `feature` スコープの下限どおり行カバレッジ **80% 以上**（CDK のコードは対象外）。Build and Test がプロジェクト全体で確認する

## モック・スタブの方針

- DynamoDB: DynamoDB Local
- 時刻: `vi.useFakeTimers()`（取り消しの期限の試験）
- EventBridge: U1 と同じモック（送信の試行回数の違い〈承認・却下は最大3回、取り消しは1回〉をテストで区別できるようにする）

## テストデータ

- 既存の `backend/test/helpers/reporting.ts`・`backend/test/helpers/events.ts` を再利用する
- 同時操作の試験用に、2人の依頼元のJWTフィクスチャを `backend/test/helpers/jwt.ts`（既存）から追加で用意する
