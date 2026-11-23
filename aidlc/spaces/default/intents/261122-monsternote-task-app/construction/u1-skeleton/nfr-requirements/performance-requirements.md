# Performance Requirements（性能と画面の要件）— U1 `u1-skeleton`

入力: `inception/requirements-analysis/requirements.md`（NFR2・NFR7・NFR8・NFR9）、`inception/contract-design/contract-summary.md`（時間切れ 10 秒・2 秒）、`construction/u1-skeleton/functional-design/`（functional-spec、rules）、nfr-requirements-questions.md（Q1〜Q7）。

前提の規模: 同時の利用者 10 人以下、報告は月 50 件未満（NFR3）。

## 1. 応答時間

| ID | 要件 | 測り方 | 出典 |
|---|---|---|---|
| NFR2.1 | 一覧（`GET /v1/catalog/*`）と詳細（`GET /v1/reports/{id}`・`GET /v1/reviews/{id}`）は、95% のリクエストで 3 秒以内（API Gateway が受けてから返すまで） | API Gateway の Latency の p95（CloudWatch のメトリクス） | NFR2 |
| NFR2.2 | 報告の送信（`POST /v1/reports`）は、95% のリクエストで 10 秒以内。内部の呼び出し（C10）は 1 回 2 秒で時間切れ | 同上 | NFR2、contract-summary 2.3 |
| NFR2.3 | 承認（`PUT /v1/reviews/{id}/decision`）は、95% のリクエストで 3 秒以内 | 同上 | NFR2 |
| NFR2.4 | 写真のアップロード（縮小後 1 MB 前後の 1 枚）は、4G の回線で 5 秒以内を目安とする | 画面での計測（細い版の確認のとき） | NFR2 |
| NFR2.5 | 関数の起動の遅れ（コールドスタート）を含めても NFR2.1〜NFR2.3 を守る。守れないときは、関数をまとめる・依存を減らすで対処し、常時起動の設定（費用がかかる）は使わない | dev で、しばらく使わなかったあとの最初の呼び出しを測る | NFR2、NFR12 |

## 2. 画面の要件

| ID | 要件 | 測り方 | 出典 |
|---|---|---|---|
| NFR7.1 | ハンター側の文字 20px 以上、ボタン高さ 64px 以上・画面幅いっぱい・間隔 16px 以上。依頼元側は文字 16px、ボタン 48px。色だけで意味を伝えない。コントラスト比 4.5:1 以上（WCAG 2.1 AA） | E2E（Playwright）で寸法を、axe で自動の検査を行う | NFR7、accessibility-checklist |
| NFR8.1 | MUI（マテリアルデザイン）の部品と、森の緑のテーマを使う。画面の文字は日本語 | 画面の確認 | NFR8、design-system-mapping |
| NFR9.1 | ハンター側は iPhone の Safari と Android の Chrome（最新と 1 つ前）、依頼元はパソコンの Chrome・Edge（最新）で動く。対象外のブラウザでは対応するブラウザを案内する | 細い版の確認のときに実機で確かめる | NFR9 |
| NFR9.2 | 画面のファイル（ビルド後）は、ハンター用で 500 KB 以下（圧縮後）を目安とし、4G の回線で最初の表示が 3 秒以内 | ビルドの結果の大きさ、画面での計測 | NFR2・NFR9 |

## Assumptions & Open Questions

- 画面のファイルの大きさ 500 KB は、MUI と React を使う場合の目安。超えたら、使う部品だけを読み込む形にする。 [assumption]
