<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-23T20:57:41Z — U2 の受け入れ基準が直接指す U1 の決まり（写真の形式、送信のキー、保存の知らせ、アップロードの完了）を U2 の rules.md に書き直して載せた。追跡の検査は Unit ごとの rules.md だけを見るため、ほかの Unit の決まりを target にできない。
- 2026-11-23T20:57:41Z — U2 の BR6 を「種類の判別」に割り当てた。U1 の rules.md では BR6.1 を「共通のエラーの形」に使っているが、Unit ごとに rules.md が別なので番号は衝突しない。
- 2026-11-23T20:57:41Z — AC6.4.1・AC6.4.2（US6.4 は U4 のストーリー）は、裏側の決まり（基準の適用 BR8.10、対象地域の確認 BR2.16）が U2 にあるため OK とし、画面の操作を確かめる AC6.4.3 だけを U4 送りにした。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-23T20:57:41Z — 対象地域を「中心＋半径」から四角い範囲に変えた（Q3）。requirements FR2.14、components の Setting、約束 C6、ストーリー AC6.4.2 の文言が、いずれもこの形に合わなくなる。functional-spec の D-1 に記録した。
- 2026-11-23T20:57:41Z — 写真の受け付けを JPEG だけにした（D-4）。FR2.12 が「端末で JPEG に縮小してから送る」と決めているため、サーバーが PNG・HEIC を受け付ける理由がない。約束 C2 の文言と食い違う。
- 2026-11-23T20:57:41Z — U1 で作った LocationGate（送信時の位置情報の許可）を U2 では使わない。捕獲場所が写真の撮影情報か地図で指した場所に変わるため。
- 2026-11-24T06:05:00Z — レビュー R-01 の直し: `Report.duplicateSuspected` を消した。DuplicateDetection から Reporting への書き戻しの経路が約束にないため、持たせても永遠に false のままになる。疑いの正本は DuplicateSuspicion（C5）、一覧の印は ReportListItem（C14）。functional-spec の D-7 に記録した。
- 2026-11-24T06:05:00Z — レビュー R-02 の直し: `ReportFootprint` に savedReceived・lastSavedEventAt・lastStatusEventAt を足し、BR8.11 を新しく作った。却下の知らせが保存の知らせより先に届く場合（contract-summary 2.5 が要求）を扱えていなかった。U1 の ReportListItem と同じ組み立て方にそろえた。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-23T20:57:41Z — 重複の相手の絞り込みに「種類＋捕獲日」の索引を選んだ（Q5-A）。ジオハッシュより読む件数は増えるが、数人の試験運用では多くて数十件で、格子の境目の扱いがない分だけ試験が書きやすい。
- 2026-11-23T20:57:41Z — 24 時間の削除を AWS の自動削除に任せた（Q4-A）。きっかり 24 時間では消えないため、代わりに「報告に使えるのは 24 時間以内の写真だけ」という決まり（BR2.14）をサーバー側に置いた。
- 2026-11-23T20:57:41Z — 疑いの行（DuplicateSuspicion）を組ごとに 2 行作る（C14 の取り決め）。1 行にして双方向に引く形より行数は倍になるが、報告 ID で引くだけで済み、U3 の一覧の印も作りやすい。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-23T20:57:41Z — AC6.4.2 の文言（中心の地点と半径 20 km）は、U4 が設定の画面を作るときに四角い範囲の言い方へ直す必要がある。U4 の Functional Design で扱う。
- 2026-11-23T20:57:41Z — 地図の表示に使うタイル（OpenStreetMap など）の選定と利用の条件は Code Generation で確かめる。地名を求める API は使わない（Q2）。
- 2026-11-23T20:57:41Z — 判別の精度の確認（FR3.5。3 種類それぞれ 10 枚以上で 70% 以上）に使う写真を、どこから用意するか。Build and Test で要る。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
