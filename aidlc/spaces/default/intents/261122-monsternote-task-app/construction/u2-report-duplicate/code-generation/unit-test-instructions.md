# Unit Test Instructions — U2 `u2-report-duplicate`

## テストの枠組み

- 単体・結合試験: Vitest（U1 と同じ設定、`vitest.workspace.ts`）
- CDK の構成の試験: `aws-cdk-lib/assertions`（行カバレッジの対象外）
- E2E: Playwright（AWS なし。API はモック）

## このUnitだけを動かすコマンド

```bash
npx vitest run backend/src/species-detection backend/src/duplicate-detection backend/src/settings backend/src/reporting backend/src/handlers/reporting.u2.test.ts backend/src/handlers/duplicate-detection.u2.test.ts backend/src/handlers/settings.u2.test.ts
```

```bash
npx vitest run frontend/hunter/src frontend/requester/src frontend/ui-kit/src --project frontend
```

```bash
npx vitest run infra/test/stacks.u2.test.ts
```

E2E（AWS なし。モックで判別・重複の確認まで）:

```bash
npx playwright test e2e/u2-species-duplicate.spec.ts
```

いずれも DynamoDB Local（`backend/test/helpers/tables.ts`）と Rekognition のモック（AWS SDK のモック。実際の Rekognition は呼ばない）を使い、プロジェクト全体のテストは実行しない。

## 期待するカバレッジ

- `feature` スコープの下限どおり行カバレッジ **80% 以上**（自分で書いたアプリのロジック。CDK のコードは対象外）
- Build and Test がプロジェクト全体のテストで確認する。このUnit単体のコマンドでの通過は、この下限の判定そのものではない

## モック・スタブの方針

- Amazon Rekognition: `@aws-sdk/client-rekognition` を Vitest のモックで置き換え、`DetectLabels` の成功・時間切れ・失敗の3パターンを返せるようにする
- DynamoDB: DynamoDB Local（U1 と同じ構成）
- EventBridge: U1 と同じ、呼び出しの記録を確認するモック
- OpenStreetMap のタイル: フロントエンドの単体試験では実際のネットワーク呼び出しを行わず、タイルの URL の組み立てだけを確認する

## テストデータ

- 試験用の写真: 既存の `backend/test/helpers/reporting.ts` の小さな JPEG のフィクスチャを再利用し、全身・尻尾などの種類の印を追加する
- 重複の判定用: 同じ種類・近い場所・近い時刻の2件の報告データを `backend/test/helpers/duplicate-fixtures.ts`（新規）に用意する
