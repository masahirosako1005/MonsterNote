# Smoke Test Results — Deployment Execution

`npm run smoke`（`scripts/smoke.ts`）を、`MonsterNote-Api-dev`再デプロイ・`MonsterNote-WebContent-dev`デプロイの完了後に実行した。

## 1. 1回目の実行（失敗。原因は実装ではなくスモークスクリプト側）

| # | 手順 | 結果 |
|---|---|---|
| 1 | 2つの画面とconfig.jsonが開ける | ✔ |
| 2 | 試験用のハンターでログインできる | ✔ |
| 3 | 写真を受け付け、S3に署名付きPOST、完了を知らせる | ✔ |
| 4 | 報告を送れる | ✘ `POST /v1/reports` → 400 `VALIDATION_FAILED`（`photos.tail`・`ageClass`・`captureMethod`・`capturedAt`・`location`が未指定） |

**原因**: `scripts/smoke.ts`は、U1スケルトン確認の時点で書かれたまま更新されておらず、全身の写真1枚・`species`・`sex`だけを送る古い送信内容になっていた。Build and Testステージで発見・修正したハンターの報告送信の欠陥（尻尾の写真・`ageClass`・`captureMethod`・`capturedAt`・`capturedAtSource`・`locationSource`が必須になった）を、画面側の修正には反映したが、`scripts/smoke.ts`には反映し忘れていた。**これは実際のデプロイ・バックエンドの不具合ではない**（バックエンドの検証ロジックが正しく働いて拒んだ結果であり、意図どおり）。画面（`frontend/hunter`）自体は正しい内容を送る実装になっている（単体試験・E2Eで確認済み）。

## 2. 修正

`scripts/smoke.ts`に、全身の写真に続けて尻尾の写真も受け付けてアップロードする処理を追加し、`POST /v1/reports`の送信内容に`photos.tail`・`ageClass: 'adult'`・`captureMethod: 'trap'`・`capturedAt`（現在時刻）・`capturedAtSource: 'manual'`・`locationSource: 'manual'`を追加した。`npx tsc --noEmit`（`scripts/tsconfig.json`を含む`npm run typecheck`）で型の整合を確認済み。

## 3. 2回目の実行（全件成功）

| # | 手順 | 結果 |
|---|---|---|
| 1 | 2つの画面とconfig.jsonが開ける | ✔（1303 ms） |
| 2 | 試験用のハンターでログインできる | ✔（752 ms） |
| 3 | 写真（全身・尻尾）を受け付け、S3に署名付きPOST、完了を知らせる（CORSを含む） | ✔（2505 ms） |
| 4 | 報告を送れる | ✔（3621 ms） |
| 5 | ハンターの一覧に10秒以内に「確認中」が出る（EventBridgeの配達） | ✔（2272 ms） |
| 6 | 依頼元でログインし、一覧に出た報告を承認できる | ✔（3295 ms） |
| 7 | ハンターの一覧が10秒以内に「承認」になる | ✔（1510 ms） |

**スモークはすべて通った。** 負荷はかけていない（1回の報告送信のみ。project.mdのForbidden「NEVER run load tests that could exceed the Free Tier」どおり）。
