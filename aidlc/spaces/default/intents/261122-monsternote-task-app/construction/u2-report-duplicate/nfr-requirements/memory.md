<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T23:45:00Z — U1 の tech-stack-decisions は「U2〜U4 も同じ」と明記しているため、U2 では新しく要るもの（画像認識・地図のタイル・TTL・索引の形・距離の計算）だけを書いた。
- 2026-11-23T23:45:00Z — 送信の 10 秒（NFR2.2）の内訳を表にして、U2 で増える処理（重複の問い合わせ 2 秒、設定の読み出し 2 秒）が収まることを示した。判別は写真のアップロードのときに終わるため、送信には含まれない。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-24T00:05:00Z — レビュー R-01 の直し: ADR-009 と約束 C8 は「Reporting が定期の処理で SpeciesDetection に判別の結果を消してもらう」としているのに、TTL に任せる決定（機能設計の Q4）との食い違いを書いていなかった。tech-stack-decisions に「約束・ADR との違い」の節を作って D-1 として明記した。NFR の文書にも、約束との違いを書く場所が要る。
- 2026-11-24T00:05:00Z — レビュー R-02 の直し: 判別の回数の上限を「送信のキーにつき 10 回」としたが、判別は送信のキーがまだ無い時点（写真のアップロード）に動くため実現できない。「1 人のハンターにつき 1 日 30 回」に変えた。上限を決めるときは、数える単位がその処理の時点で存在するかを確かめる。
- 2026-11-24T00:05:00Z — レビュー R-04 の直し: 「24 時間で自動的に消える」と書いたが、DynamoDB の TTL は「48 時間以内」、S3 のライフサイクルは 1 日 1 回の処理。AWS のサービスの保証の中身を確かめずに書いていた。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T23:45:00Z — 判別の区切りを 3 秒にした（Q1-A）。8 秒まで待てば判別できる割合は上がるが、ハンターを待たせる。手で選べば報告は作れるため、待たせない側を選んだ。
- 2026-11-23T23:45:00Z — 送信の前の重複の問い合わせが失敗しても送信を通す（Q3-A）。重複の見逃しより、ハンターの足止めを避けることを優先した。保存のあとの判定で見つかるため、見逃しにはならない。
- 2026-11-23T23:45:00Z — アラームを増やさず、ログから数える形にした（Q5-A）。すぐ気づけないが、無料枠のアラーム 10 個を U3・U4 のために残せる。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T23:45:00Z — Rekognition のラベル（Pig・Hog・Boar など）をイノシシ・シカ・クマに対応付ける表を Code Generation で作る必要がある。1 つの動物が複数のラベルに散る。
- 2026-11-23T23:45:00Z — 判別の呼び出しの回数（10 回の上限）をどこに覚えるかは NFR Design で決める。
- 2026-11-23T23:45:00Z — 判別の精度の確認（FR3.5）に使う写真の入手先が未定。Build and Test の前に決める。
- 2026-11-24T00:25:00Z — レビュー R-06（Major）: NFR12.5 を「1 人 1 日 30 回」に直したのに、security-requirements の脅威の表に古い「1 つの報告につき 10 回」が残っていた。同じ数字を 2 か所に書くと、片方を直し忘れる。数字を直すときは、全部のファイルを grep して確かめる。
- 2026-11-24T00:25:00Z — レビュー R-07・R-08 の直し: 日の区切りを日本時間と明記し（索引は UTC なので区切り方が違うことも書いた）、数を増やす書き込みを条件にした 1 回の書き換えにした。Infrastructure Design は Code Generation より先に動くため、D-1 の申し送りを tech-stack-decisions に書いた。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
