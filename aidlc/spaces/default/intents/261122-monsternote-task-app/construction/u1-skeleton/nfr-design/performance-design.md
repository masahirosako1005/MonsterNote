# Performance Design（性能の設計）— U1 `u1-skeleton`

入力: `construction/u1-skeleton/nfr-requirements/performance-requirements.md`（NFR2・NFR7・NFR8・NFR9）、logical-components.md、`construction/u1-skeleton/functional-design/rules.md`（BR4.2〜BR4.4）、`inception/refined-mockups/design-system-mapping.md`、nfr-design-questions.md。

| ID | 設計 |
|---|---|
| NFR2.1 | 一覧は ReportCatalog の表だけを 1 回のクエリで読む（並びを表のキーにする: 依頼元用は全件の索引、ハンター用はハンターの ID の索引、どちらも送信日時の新しい順）。詳細は Reporting と Review の表をキーで 1 件ずつ読む。表の全体を読む（scan）処理は作らない |
| NFR2.2 | 送信の処理は、送信のキーの確認 → Accounts の確認（C10、2 秒）→ トランザクションの書き込み → EventBridge への送信（1 回 0.5 秒、最大 3 回）。最悪で約 5.8 秒、関数の時間切れは 8 秒で、画面の 10 秒に収まる（reliability-design の時間の予算） |
| NFR2.3 | 承認は、条件付きの書き込み 1 回と EventBridge への送信（最大 3 回）。最悪で約 3 秒（関数の時間切れ 8 秒）。通常は 1 秒未満 |
| NFR2.4 | 写真は画面で長辺 2,048 px の JPEG に縮小してから、期限付きの URL で S3 に直接送る（API Gateway・関数を通さない） |
| NFR2.5 | 関数は部品ごとに 1 つずつで、使うライブラリを AWS SDK の必要な部分だけにする（esbuild でまとめて小さくする）。Arm・Node.js 22。常時起動の設定は使わない |
| NFR7.1 | UiKit の 2 つのテーマで文字とボタンの大きさを決め、画面ごとに上書きしない。E2E で寸法を、axe で自動の検査を行う |
| NFR8.1 | MUI の部品と森の緑のテーマ（design-system-mapping の色の値） |
| NFR9.1 | Vite のビルドの対象を、対応するブラウザ（Safari・Chrome・Edge の最新と 1 つ前）に合わせる。対象外のブラウザでは案内を表示する |
| NFR9.2 | 画面のファイルは画面ごとに分けて読み込む（ルートごとの遅延読み込み）。MUI のアイコンは使うものだけを読み込む。CloudFront で圧縮（gzip・Brotli）とキャッシュ（ビルドのファイル名にハッシュを付け、長くキャッシュ。index.html はキャッシュしない） |

## Assumptions & Open Questions

- 一覧の表の索引の具体（キーと並び）は Infrastructure Design と Code Generation で決める。 [assumption]
