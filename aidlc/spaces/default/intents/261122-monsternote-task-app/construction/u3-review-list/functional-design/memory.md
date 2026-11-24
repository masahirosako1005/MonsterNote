<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T22:28:41Z — U3 は新しいデータを作らず、U1 の ReviewDecision と ReportListItem に項目を足すだけにした。U1 で「U3」と注記していた項目（reason・reasonText・undoUntil・duplicateSuspected）がここで本番になる。
- 2026-11-23T22:28:41Z — 「先に受け付けた操作だけが有効」（AC4.6.1）は、確認中であることを条件にした 1 回の書き換えで実現する。読んでから書く形にすると、2 人が同時のときに両方成功しうる。
- 2026-11-23T22:28:41Z — 取り消しの 10 秒（undoUntil）は「本人が取り消せる期限」と「ほかの人の操作を止める期限」を兼ねる。FR8.5 と FR8.6 が同じ 10 秒を指しているため、2 つに分けなかった（BR3.11）。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-23T22:28:41Z — 約束 C4 の全件数に「これ以上ある」の印を足した（D-1）。絞り込みのときに条件に合う行を最後まで数えるため、読む上限（2,000 件）を置いた（Q1・Q2。無料枠を守るため）。
- 2026-11-23T22:28:41Z — 一覧の行に緯度・経度を足した（D-2）。U2 で placeName を空のままにしたため、一覧で場所を示す手段が要る。
- 2026-11-23T22:28:41Z — U1 で動いているコードを直す（D-4）。decidedByName が無いときに利用者の ID を入れていたのを「依頼元の担当者」に変える。U1 のレビューで残った Minor の指摘の解消にあたる。
- 2026-11-24T07:40:00Z — レビュー R-01 の直し: 取り消し（BR3.9）も、承認・却下と同じ「条件にした 1 回の書き換え」にした。順に IF で判定する形だと、本人の二重送信で 1 回目の成功後に decidedByAccountId が空になり、2 回目が「本人ではない（403）」と誤って返りうる。
- 2026-11-24T07:40:00Z — レビュー R-02 の直し: `decidedByName` を読み出しのときにも置き換える（UUID の形なら「依頼元の担当者」）。U1 はすでに dev で動いており、コードを直すだけでは保存済みの記録に残る ID を消せない。データの作り直しは避けた。
- 2026-11-24T07:40:00Z — レビュー R-03 の直し: AC4.1.1・AC4.1.3・AC4.1.4 を N/A（u1-skeleton が達成）にした。story map は U3 の範囲を AC4.1.2 だけに限っているのに、追跡の道具が US4.1 の基準をすべて U3 に並べたため、そのまま OK にしていた。
- 2026-11-24T07:40:00Z — レビュー R-04 の直し: 状態の読み出し（GET /v1/reviews/{id}）が本人にだけ undoUntil を返す決まり（BR3.15）を足した。約束 C3 への追加として D-5 に記録。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T22:28:41Z — 絞り込みに索引を増やさず、読んでから除く形を選んだ（Q1-A）。数千件を超えると遅くなるが、索引 5 つと「両方を満たす」の組み合わせを作る複雑さを避けられる。件数が増えたときに索引を足せる。
- 2026-11-23T22:28:41Z — 日数と「7 日以上」の印をデータに持たせず、読み出しのたびに計算する（Q4-A）。定期の処理を 1 つ増やさずに済み、日付が変わった直後にずれない。
- 2026-11-23T22:28:41Z — 状態の知らせを 10 秒待たずにすぐ送る（Q3-A）。ハンターの一覧が「承認 → 確認中」と行き来しうるが、知らせを遅らせる仕組みを作らずに済み、依頼元の画面と一覧がずれない。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T22:28:41Z — 読む上限 2,000 件に達したときの表示（「2,000 件以上」）の言い回しは、Refined Mockups の interaction-spec に合わせる必要がある。
- 2026-11-23T22:28:41Z — U3 は U2 と並行して作れるが、duplicate.suspected の知らせを受ける試験は、約束どおりの試験用の知らせで行う。U2 と合わせた試験は Build and Test で行う。
- 2026-11-24T08:05:00Z — レビュー R-06 の直し（人の指示で、確定した READY のあとに直した）: 取り消しの新しい応答 409 ALREADY_UNDONE を、約束との違いの表（D-6）、角のケース、画面の入力の確認の表に書き足した。直しそのものが新しい応答を生んだのに、その記録を忘れていた。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
