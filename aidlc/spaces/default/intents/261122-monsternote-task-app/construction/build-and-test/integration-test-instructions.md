# Integration Test Instructions — Build and Test（Standard戦略）

Test Strategy: Standard（`aidlc-state.md`）。主要な結合点・Unit をまたぐ相互作用の試験を対象とする。

## 1. 試験の枠組みと設定

- フレームワーク: Vitest 5（`vitest.workspace.ts` で backend・frontend・infra の3プロジェクトを束ねる）。
- 結合試験はDynamoDB Local（npmパッケージが試験ごとに起動・表を作成・終了時に停止）で、単体試験のモック（`aws-sdk-client-mock`）より実際のDynamoDBの挙動（条件付き書き込み・予約語・GSIなど）に近い確認を行う。

## 2. 実行コマンド

```bash
# 結合試験（DynamoDB Local。U1のskeleton-flow、U3のreview-flow）
npx vitest run backend/test/integration

# Unit をまたぐ相互作用（EventBridgeの知らせの受け渡し）は各部品の
# on-saved / on-status / on-recorded の単体試験が、知らせの送り手が作る
# EventEnvelopeの実際の形を使って確認している（モックのPutEventsCommand経由）
```

## 3. 主要な境界（Key boundary tests）

| 境界 | 試験の場所 | 確認内容 |
|---|---|---|
| Reporting → Review・ReportCatalog（`report.saved`） | `backend/src/review/on-saved.u1.test.ts`・`backend/src/catalog/on-saved系`・`backend/test/integration/skeleton-flow.u1.test.ts` | 報告の保存が、確認待ちの記録と一覧の行の両方を作ること |
| Reporting → DuplicateDetection（`report.saved`の再判定。ADR-003） | `backend/src/duplicate-detection/on-saved.u2.test.ts` | 保存後に重複の索引と疑いが更新されること |
| Review → ReportCatalog・DuplicateDetection（`review.status-changed`） | `backend/src/catalog/on-status系`・`backend/src/duplicate-detection/on-status.u2.test.ts` | 却下・取り消しで一覧の状態と重複の索引のactiveが連動すること |
| DuplicateDetection → ReportCatalog（`duplicate.suspected`。U3） | `backend/src/handlers/consumers.ts`経由の`catalogOnStatus`が振り分け | 重複の疑いの印が一覧に反映されること |
| 各部品 → AuditLog（`audit.recorded`。U4） | `backend/src/audit-log/on-recorded.u4.test.ts` | eventIdを条件にした1回だけの記録（二重登録しないこと） |
| Reporting ⇄ Accounts・Settings・DuplicateDetection（内部の直接の呼び出し。C9・C10） | `backend/src/reporting/submit.u1.test.ts`ほか | 部品の身元の証明（ADR-011）での呼び出しが正しく動くこと |
| 各API関数 ⇄ Accounts（`caller-status`。U4のmustChangePasswordゲート） | `backend/src/handlers/handlers.u4.test.ts` | 仮のパスワードのままの利用者が、該当の道以外すべてで403になること |
| DynamoDB Local（実際の書き込み。結合） | `backend/test/integration/skeleton-flow.u1.test.ts`・`u3-review-flow.u3.test.ts` | 予約語（`location`）・条件付き書き込み・GSIクエリが実際のDynamoDBの挙動と合うこと |

## 4. 期待するカバレッジ

- 結合試験は単体試験のカバレッジの床（80%）には数えない別建ての確認（DynamoDBの実際の挙動の確認が主目的）。floorの対象は単体試験中心の`backend/src`・`frontend/*/src`。
- 既存の結合試験ファイルは2本（U1のskeleton-flow、U3のu3-review-flow）。U2・U4はEventBridgeの知らせの受け渡しを単体試験のモック経由で確認する方針（nfr-design/reliability-design.mdの既定）で、追加の結合試験ファイルは設けていない。

## 5. 試験データと環境

- DynamoDB Local: 試験ごとに一時テーブルを作成し、終了時に削除（他の試験と共有しない）。
- 個人情報に見える値は使わない（`hunter-a`等の試験用ID、固定の緯度経度）。
- AWSの認証情報は不要。ネットワークアクセスなし。
