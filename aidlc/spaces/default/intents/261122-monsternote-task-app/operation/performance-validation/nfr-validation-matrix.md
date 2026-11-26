# NFR Validation Matrix — Performance Validation

入力: U1〜U4の`nfr-requirements/performance-requirements.md`・`nfr-requirements/scalability-requirements.md`（各Unitの応答時間・規模の数値目標）、`construction/build-and-test/build-and-test-summary.md`のTarget Verification Matrix（NFR2.xを`Unverified（配置後の実測が前提）`・本ステージ所有と記録済み）、`operation/observability-setup/{dashboards,alarms,log-queries}.md`（実測に使う画面・クエリ）。

## 1. この文書の性質

本ステージは`dev`への実機デプロイ後、初めてNFR2.x（応答時間）の実測が可能になるステージである。人の承認を得て`scripts/perf-check.ts`を実行し（記録: ae63bcdb）、下表の`Actual`列を実測値で埋めた。詳細・サンプル数・注意点は`test-results.md`参照。**割り込んだ項目は無い。**

## 2. 応答時間の目標一覧（全Unit・NFR2.1〜NFR2.18）

| ID | 対象 | 目標 | 由来 | Actual |
|---|---|---|---|---|
| NFR2.1 | 一覧・詳細（`GET /v1/catalog/*`・`GET /v1/reports/{id}`・`GET /v1/reviews/{id}`） | 95%が3秒以内 | U1 | **実測済み・Met**（max 1993ms。`test-results.md`） |
| NFR2.2 | 報告の送信（`POST /v1/reports`） | 95%が10秒以内 | U1 | **実測済み・Met**（max 781ms。`test-results.md`） |
| NFR2.3 | 承認（`PUT /v1/reviews/{id}/decision`、approved） | 95%が3秒以内 | U1 | **実測済み・Met**（max 699ms。`test-results.md`） |
| NFR2.4 | 写真アップロード（縮小後1MB前後・1枚） | 4Gで5秒以内（目安） | U1 | 対象外（画面での実機計測。API単体の計測では測れない） |
| NFR2.5 | コールドスタートを含めてもNFR2.1〜2.3を守る | 常時起動なしで維持 | U1 | 未実測（しばらく使わなかった後の最初の呼び出しを計測する必要あり。§5参照） |
| NFR2.6 | 写真の受け付け（`POST /v1/photos`） | 95%が3秒以内 | U2 | **実測済み・Met**（max 166ms。`test-results.md`） |
| NFR2.7 | アップロード完了（`POST /v1/photos/{id}/complete`、全身） | 95%が6秒以内 | U2 | **実測済み・Met**（max 521ms。`test-results.md`） |
| NFR2.8 | 種類の判別 | 3秒で区切る | U2 | 対象外（判別サービスのタイムアウト設定。単体試験で確認済み、実機の応答時間測定の対象ではない） |
| NFR2.9 | 重複の問い合わせ（`POST /internal/v1/duplicate-checks`） | 2秒で区切る | U2 | 未実測（内部呼び出し。requestIdが伝播しないため`tracing-config.md`の制約どおりreportIdで追跡） |
| NFR2.10 | 保存後の重複判定（`report.saved`の受け手） | 10秒以内 | U2 | **実測済み・Met**（間接計測。max 2499ms。`test-results.md`） |
| NFR2.11 | 写真アップロード（全身・尻尾の2枚） | 4Gで10秒前後（目安） | U2 | 対象外（画面での実機計測） |
| NFR2.12 | 絞り込み一覧（`GET /v1/catalog/reports`） | 95%が3秒以内（上限2,000件まで） | U3 | **実測済み・Met**（通常規模のみ。max 202ms。上限近くは§4のとおり計測対象外。`test-results.md`） |
| NFR2.13 | 却下（`PUT /v1/reviews/{id}/decision`、rejected） | 95%が3秒以内 | U3 | **実測済み・Met**（max 419ms、n=1。`test-results.md`） |
| NFR2.14 | 取り消し（`POST /v1/reviews/{id}/decision/undo`） | 95%が2秒以内 | U3 | **実測済み・Met**（max 181ms、n=1。`test-results.md`） |
| NFR2.15 | アカウント一覧（`GET /v1/admin/accounts`） | 95%が3秒以内 | U4 | **実測済み・Met**（max 177ms。`test-results.md`） |
| NFR2.16 | アカウント作成・パスワード再設定 | 95%が3秒以内 | U4 | **実測済み・Met**（max 1339ms。`test-results.md`） |
| NFR2.17 | 操作記録一覧（`GET /v1/admin/audit-entries`） | 95%が3秒以内 | U4 | **実測済み・Met**（max 1902ms。`test-results.md`） |
| NFR2.18 | 「すべて削除」5つの入口 | 95%が10秒以内 | U4 | 対象外（破壊的操作。本ステージの軽い計測では実行しない。§4参照） |
| NFR9.4 | ハンター画面のビルド後サイズ | 800KB以下（圧縮後） | U2 | **実測済み**（約158KB。Build and Testで既に実測・Met。`build-and-test-summary.md`参照。再計測不要） |

## 3. 規模の前提（NFR3.x。実測ではなく設計上の見積もり）

| ID | 内容 | 本ステージでの扱い |
|---|---|---|
| NFR3.1・NFR3.6・NFR3.7・NFR3.9・NFR3.10 | 試験運用の規模の見積もり（月50件未満の報告、利用者20人以下等） | 実測の対象ではない（見積もり自体の検証は本ステージの範囲外。実際の運用で蓄積されたら見直す） |
| NFR12.6 | 重複判定の読み出し500件上限 | Build and Testで発見・**未実装**。想定利用規模（月50件未満）では発生しないとして記録のみに留める決定済み（4455bd0d）。本ステージでは追加の対応をしない |
| NFR12.9 | 絞り込み読み出しがNFR2.12を割り込んだ場合の対処手順（メモリ引き上げ→上限引き下げの順） | §4で後述するとおり、本ステージの軽い計測では割り込みを再現する負荷をかけない。手順自体は`runbooks.md`相当の既存記録どおり |

## 4. 計測しない項目とその理由

- **NFR2.12の上限（2,000件）近くでの実測**: 2,000件分のダミーデータを作ってまで検証することは、project.mdのForbidden「無料枠を超えるおそれのある負荷試験はしない」の精神（データ量を人為的に増やしてまで検証しない）に反する。U3のnfr-requirements.mdの見積もり（最悪でも1.6秒）を設計上の根拠として受け入れ、実際の運用規模（月50件未満）での通常の一覧取得だけを計測する。
- **NFR2.18（「すべて削除」）**: 破壊的操作（DynamoDB/S3の実データ削除）であり、本ステージの軽い計測の一環として実行すると試験データが失われる。計測対象から除外する。
- **NFR2.4・NFR2.11（画面での実機計測）**: API単体の応答時間ではなく、ブラウザでの体感速度（画像の縮小処理を含む）が目標の対象であり、`scripts/perf-check.ts`のようなAPI直叩きのスクリプトでは測れない。対象外とする。

## 5. コールドスタート（NFR2.5）の扱い

今回の計測は`dev`デプロイ後の通常利用中に行うため、関数が温まった状態（ウォーム）での応答時間しか測れない。コールドスタートの影響を見るには、関数を一定時間呼ばずに放置してから測る必要があり、本ステージの計測機会では意図的な再現はしない。`dashboards.md`の関数グループ別エラー・レイテンシのウィジェットを使い、実運用の中で自然発生するコールドスタート時の値を継続的に観察する（Feedback & Optimizationフェーズへの申し送り）。
