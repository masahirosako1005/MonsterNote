# Observability Design（監視の設計）— U2 `u2-report-duplicate`

入力: `construction/u2-report-duplicate/nfr-requirements/observability-requirements.md`（NFR10.18〜NFR10.20、NFR11.9〜NFR11.13、NFR14.1〜NFR14.2）、performance-design.md・reliability-design.md（U2 の分）、`construction/u1-skeleton/nfr-design/observability-design.md`（U1 の設計。ログの形・アラームをここで引き継ぐ）。

U1 のログの形（JSON、共通のロガー）とアラーム 2 つ（API の 5xx、関数のエラー）をそのまま使う。U2 でアラームは増やさない（NFR10.18）。

## 1. ログの項目（U2 で足すもの）

| 場面 | 記録する項目 |
|---|---|
| 判別の呼び出し | `photoId`、`outcome`、`confidence`（detected のとき）、`failureReason`（undetected のとき）、`durationMs`。生のラベルと保存場所のキーは出さない |
| 判別の上限超過 | `accountId`、`errorCode=DETECTION_LIMIT_REACHED`、その日の `callCount` |
| 重複の判定 | `phase`（pre-submit・post-save）、`readCount`、`matchCount`、`durationMs`、`limitReached`（真偽） |
| 送信前の問い合わせの失敗 | `errorCode=DUPLICATE_CHECK_FAILED`。緯度・経度は出さない |
| 写真のアップロードの失敗 | `reason`（形式・大きさ・期限切れ）。保存場所のキーは出さない |

## 2. 必要なときに見る値（アラームは作らない。NFR10.19）

CloudWatch Logs Insights のクエリ例（Infrastructure Design で保存しておく）:

```
fields @timestamp, accountId, callCount
| filter errorCode = "DETECTION_LIMIT_REACHED"
| stats count() by accountId
```

- 判別の失敗の割合（`outcome=undetected` の件数 ÷ 全体）
- 判別の時間切れの回数（`failureReason=timeout`）
- 重複の判定で読んだ件数の分布、上限（500 件）に当たった回数
- 送信前の問い合わせの失敗の回数

## 3. 監査の記録（U2 で足すもの。NFR14.1〜NFR14.2）

| ID | 設計 |
|---|---|
| NFR14.1 | Reporting・SpeciesDetection・DuplicateDetection の各処理の終わりに `audit.recorded`（C15）を送る。受け手（AuditLog）は U4 で作るため、記録されるのは U4 のあと |
| NFR14.2 | 送る知らせの `action`: `report.submitted`（送信の成功）、`duplicate.suspected`（重複の疑いを付けたとき）。`action` は約束 C15 の `audit.recorded` の項目に文字列として入れる（U2・U3 の NFR で見つかった曖昧さの反省。レビュー R-03 の指摘） |

## Assumptions & Open Questions

- U1 のアラーム（関数のエラー、5 分間で 3 回以上）は、U2 の関数（Reporting の拡張、DuplicateDetection、Settings）も「全関数の合計」として自動的に対象に入る。個別の設定は不要。 [assumption]
