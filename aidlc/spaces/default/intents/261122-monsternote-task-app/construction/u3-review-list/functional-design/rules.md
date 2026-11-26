# Rules（業務の決まり）— U3 `u3-review-list`

入力: entities.md、`construction/u1-skeleton/functional-design/rules.md`（U1 の決まり。BR3〈確認〉・BR4〈一覧〉を拡張する）、`construction/u2-report-duplicate/functional-design/rules.md`（U2 の BR8。重複の疑いの知らせ）、`inception/requirements-analysis/requirements.md`（requirements。FR8・FR9）、`inception/user-stories/stories.md`（stories）、`inception/domain-design/components.md`（components）・`decisions.md`、`inception/contract-design/contract-summary.md`（contract-summary）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、functional-design-questions.md（Q1〜Q6）。

番号の付け方: U3 は **BR3（確認）と BR4（一覧）の続き**で足す。U3 の受け入れ基準が直接指す U1 の決まり（確認できる人、先着、確認の記録の有無、一覧の読める人、ページ分け）は、下に書き直して載せる。

```yaml
rules:
  # BR3 確認（Review）— U1 から引き継ぐ決まり
  - id: BR3.2
    statement: 承認・却下は依頼元だけができる
    category: authorization
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision
    logic: IF role=requester THEN 受け付ける ELSE 拒む
    violation: 403 FORBIDDEN
    source: [FR8.4, NFR4]
  - id: BR3.3
    statement: 状態が「確認中」のときだけ承認・却下を受け付ける（先に受け付けた操作だけが有効）
    category: constraint
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision
    logic: >
      IF status=checking THEN 書き換える（確認中であることを条件にした 1 回の書き換え）
      ELSE 409 で、確認した人（decidedByName）と結果（status）を返す（AC4.6.1・AC4.6.2）
    violation: 409 ALREADY_DECIDED
    source: [FR8.6]
  - id: BR3.5
    statement: ハンターは自分の報告の状態だけを読める
    category: authorization
    applies_to: ReviewDecision
    trigger: GET /v1/reviews/{reportId}
    logic: IF role=requester OR (role=hunter AND ReviewDecision.hunterAccountId=自分) THEN 返す ELSE 拒む（Review は自分の記録のハンターの ID で判断し、Reporting を呼ばない）
    violation: 403 FORBIDDEN
    source: [FR9.2, FR9.4, NFR4]
  - id: BR3.7
    statement: 確認の記録がまだない報告は、操作を受け付けず、少し待ってからもう一度押すよう返す
    category: constraint
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision、GET /v1/reviews/{reportId}
    logic: IF その報告の ReviewDecision がない THEN 拒み、画面は「まだ確認の準備ができていません。少し待ってからもう一度押してください」を表示する
    violation: 404 REVIEW_NOT_READY
    source: [FR8.4]

  # BR3 確認（Review）— U3 で足す決まり
  - id: BR3.8
    statement: 却下には理由が必須。「その他」のときは文（1〜200 文字）も必須
    category: validation
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision（decision=rejected）
    logic: >
      IF reason ∈ {duplicate, insufficient-photo, out-of-scope, other} THEN 続ける ELSE 拒む;
      IF reason=other AND reasonText の中身が空白だけでない AND 1 ≤ 文字数 ≤ 200 THEN 受け付ける
      ELSE 拒む（空白だけの文は空として扱う。AC4.4.2）。
      画面でも同じ確認を行い、満たさないあいだは確定のボタンを押せなくする
    violation: 422 VALIDATION_FAILED（理由がない・その他の文がない・長すぎる）
    source: [FR8.4]
  - id: BR3.9
    statement: 確定から 10 秒間は、操作した本人だけが取り消して「確認中」に戻せる
    category: constraint
    applies_to: ReviewDecision
    trigger: POST /v1/reviews/{reportId}/decision/undo
    logic: >
      記録を読んで判断するのではなく、**「status が今も checking でない」かつ「decidedByAccountId が操作する人」かつ
      「undoUntil が今の時刻以降」であることを条件にした 1 回の書き換え**で戻す（BR3.3 と同じ作り。レビュー R-01）。
      書き換えが成功しなかったときは、そこで記録を読み直して理由を返す:
      IF status=checking THEN 409（すでに確認中に戻っている。本人の二重送信はここに入る）;
      IF decidedByAccountId≠操作する人 THEN 403（本人ではない。AC4.5.3）;
      IF 今の時刻 > undoUntil THEN 409（期限切れ。AC4.5.2）。
      この順で読むため、二重送信が「本人ではない」と誤って返ることはない。
      ALREADY_UNDONE は約束 C3 にない応答のため、functional-spec の D-6 に記録した（レビュー R-06）。
      画面はこの応答をエラーとして出さず、確認中の状態を出し直す。
      時刻はサーバーの時計で計り、画面の時計は使わない（undoUntil = decidedAt + 10 秒）
    violation: 403 FORBIDDEN / 409 UNDO_EXPIRED / 409 ALREADY_UNDONE
    source: [FR8.5]
  - id: BR3.10
    statement: 取り消すと「確認中」に戻し、確認の記録（人・日時・理由・期限）を消す
    category: policy
    applies_to: ReviewDecision
    trigger: 取り消しの受け付け
    logic: >
      status=checking にし、decidedByAccountId・decidedByName・decidedAt・undoUntil・reason・reasonText を空にする。
      そのあと review.status-changed を送る（status=checking、previousStatus=直前の状態、undone=true。C13）。
      戻したあとは誰でも操作できる（AC4.6.3）
    violation: —
    source: [FR8.5, FR8.6]
  - id: BR3.11
    statement: 取り消せる 10 秒の間も、報告は確認済みとして扱い、ほかの人の操作を受け付けない
    category: constraint
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision
    logic: >
      status が checking でないあいだ（undoUntil を過ぎていても）、ほかの人の操作は BR3.3 で 409 になる。
      10 秒の猶予は「本人が取り消せる期間」であって「ほかの人が操作できる期間」ではない（AC4.6.2）
    violation: 409 ALREADY_DECIDED
    source: [FR8.6]
  - id: BR3.12
    statement: 確認した人の名前は、ログインの証明の name から取る。無いときは「依頼元の担当者」とし、利用者の ID は画面に出さない
    category: policy
    applies_to: ReviewDecision
    trigger: 承認・却下の受け付け
    logic: >
      書き込みのとき: IF 証明に name がある THEN decidedByName=その値
      ELSE decidedByName="依頼元の担当者"（利用者の ID をそのまま入れない。Q5）。
      読み出しのとき: IF decidedByName が利用者の ID の形（UUID）に見える THEN 「依頼元の担当者」に置き換えて返す。
      U1 がすでに `dev` に保存した記録に ID が残っていても、画面には出ない（レビュー R-02。データの作り直しは要らない）。
      Accounts への問い合わせは増やさない
    violation: —
    source: [FR8.7]
  - id: BR3.13
    statement: 状態が変わるたびに「状態が変わった」知らせを送る。取り消しのときもすぐ送る
    category: policy
    applies_to: ReviewDecision
    trigger: 承認・却下・取り消しの受け付け
    logic: >
      承認・却下の確定のときにすぐ review.status-changed を送り、10 秒を待たない（Q3）。
      取り消しのときも、戻したあとすぐ送る（undone=true）。
      却下は status=rejected で、却下の取り消しは previousStatus=rejected かつ undone=true で表す（別の知らせを作らない。C13）。
      送るのは、状態を書き換える 1 回の書き換えが**成功したときだけ**（BR3.3・BR3.9）。
      二重送信や再送で書き換えが成功しなかった操作からは送らないため、1 回の状態の変化につき知らせは 1 回になる（レビュー R-05）
    violation: —
    source: [FR8.4, FR8.5]
  - id: BR3.14
    statement: ハンターは自分の報告の却下の理由を読める。送った報告の内容は直せない
    category: policy
    applies_to: ReviewDecision
    trigger: GET /v1/reviews/{reportId}（ハンター）
    logic: >
      IF status=rejected THEN 状態と reason（other のときは reasonText も）を返す。
      報告の内容を直す入口は作らない。却下の詳細からは、新しい報告の作成を始められるだけにする（AC5.2.3）
    violation: —
    source: [FR9.2]
  - id: BR3.15
    statement: 状態の読み出しでは、本人が取り消せるかどうかも返す
    category: policy
    applies_to: ReviewDecision
    trigger: GET /v1/reviews/{reportId}
    logic: >
      IF 読む人が decidedByAccountId と同じ AND 今の時刻 ≤ undoUntil THEN undoUntil を返す ELSE 返さない。
      確定の直後に画面を離れて戻っても、10 秒以内なら「取り消す」をもう一度出せる（レビュー R-04）。
      ほかの人には undoUntil を返さないため、ボタンは出ない（AC4.5.3）
    violation: —
    source: [FR8.5]

  # BR4 一覧（ReportCatalog）— U1 から引き継ぐ決まり
  - id: BR4.2
    statement: 依頼元の一覧は、すべての報告を送信の新しい順に 1 ページ 50 件で返す。0 件なら「報告はまだありません」
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports
    logic: IF role=requester THEN savedReceived=true の行を submittedAt の新しい順（同じなら reportId）に 50 件と次のページの位置を返す
    violation: 403 FORBIDDEN（依頼元以外）
    source: [FR8.1, FR8.2]
  - id: BR4.3
    statement: ハンターの一覧は自分の報告だけを新しい順に返す。0 件なら「まだ報告はありません」
    category: authorization
    applies_to: ReportListItem
    trigger: GET /v1/catalog/my-reports
    logic: IF role=hunter THEN hunterAccountId=自分 の行だけを返す
    violation: 403 FORBIDDEN（ハンター以外）
    source: [FR9.1, FR9.4]
  - id: BR4.4
    statement: 一覧のページ分けは、次のページの位置（cursor）と全件数で行う
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports、GET /v1/catalog/my-reports
    logic: >
      並び順は submittedAt の新しい順、同じなら reportId の大きい順。
      cursor は前のページの最後の行の（submittedAt、reportId）を表す、画面が中身を読まない文字列。
      次のページがなければ cursor は空。読み取った cursor が壊れていたら 400
    violation: 400 VALIDATION_FAILED（cursor が壊れている）
    source: [FR8.2]

  # BR4 一覧（ReportCatalog）— U3 で足す決まり
  - id: BR4.5
    statement: 絞り込みは「状態」と「印」の 2 種類。同じ種類どうしは「いずれか」、違う種類どうしは「両方」
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports
    logic: >
      status は checking・approved・rejected のいずれか（複数可）、flag は duplicate・manual のいずれか（複数可）。
      IF status が指定された THEN 行の status がそのどれかに当たること;
      IF flag が指定された THEN duplicate は duplicateSuspected=true、manual は manualEntry=true に当たること;
      両方が指定されたときは、両方を満たす行だけを返す（AC4.1.2）。
      知らない値が来たら 400
    violation: 400 VALIDATION_FAILED（絞り込みの値が不正）
    source: [FR8.1]
  - id: BR4.6
    statement: 「重複の疑い」の印は、重複の疑いの知らせで立てる。一度立てたら戻さない
    category: policy
    applies_to: ReportListItem
    trigger: duplicate.suspected を受けたとき
    logic: >
      IF eventId が処理済み THEN 何もしない;
      IF 行がない THEN 先に行を作り（savedReceived=false）、印だけ覚えておく（report.saved が届いたら一覧に出る）;
      ELSE duplicateSuspected=true にし、lastDuplicateEventAt を記録する。
      相手が却下されても印は消さない（U2 の「疑いの記録は残す」決まりと合わせる）
    violation: —
    source: [FR8.1, FR8.3]
  - id: BR4.7
    statement: 絞り込みは、新しい順に読んでから条件に合わない行を除いて行う。索引は増やさない
    category: policy
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports
    logic: >
      送信の新しい順に読み進め、条件に合う行が 50 件たまるか、読む上限（2,000 件）に達するまで続ける（Q1）。
      数百件の規模では 1〜2 回の読み出しで足りる
    violation: —
    source: [FR8.1]
  - id: BR4.8
    statement: 絞り込みを掛けたときの全件数は、条件に合う件数とする。読む上限を超えたときは「以上」として返す
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports
    logic: >
      条件に合う行を最後まで数えて返す（Q2）。
      読んだ行が上限（2,000 件）に達したら、そこまでの件数と「これ以上ある」の印を返し、画面は「2,000 件以上」と表示する。
      絞り込みがないときは、savedReceived=true の行の数を返す（U1 の BR4.4 と同じ）
    violation: —
    source: [FR8.2]
  - id: BR4.9
    statement: 「送ってから n 日」と「7 日以上」の印は、一覧を読むたびに送信日時と今の時刻から計算する
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports、GET /v1/catalog/my-reports
    logic: >
      経過＝今の時刻 − submittedAt。日数は 24 時間を 1 日として切り捨てる（3 日 5 時間なら「3 日」）。
      IF 経過 > 7 日 AND status=checking THEN 依頼元の一覧に「7 日以上」の印を付け、ハンターの一覧に
      「依頼元の確認に時間がかかっています。急ぐときは依頼元に連絡してください」を出す。
      ちょうど 7 日では印を付けない（7 日 1 時間で付き、6 日では付かない。AC4.7.1・AC4.7.2）。
      確認済み（承認・却下）の報告には印も日数も出さない。データには持たせない（Q4）
    violation: —
    source: [FR9.3]
  - id: BR4.10
    statement: 確認が遅れていても、アプリから催促や通知は送らない
    category: policy
    applies_to: ReportListItem
    trigger: 日数の計算
    logic: 印と画面の文字で知らせるだけで、メール・プッシュ通知・SMS は送らない（AC5.3.3）
    violation: —
    source: [FR9.3]
```

## 決まりのまとめ

| 決まり | 内容 | 出典 |
|---|---|---|
| BR3.2・BR3.3・BR3.5・BR3.7 | U1 から引き継ぐ（確認できる人、先着、読める人、記録の有無） | FR8.4・FR8.6・FR9.2 |
| BR3.8 | 却下の理由と「その他」の文（1〜200 文字） | FR8.4 |
| BR3.9〜BR3.11 | 10 秒の取り消し、戻し方、猶予の間はほかの人を止める | FR8.5・FR8.6 |
| BR3.12 | 確認した人の名前（書き込みと読み出しの両方で、利用者の ID を出さない） | FR8.7 |
| BR3.13 | 状態の知らせをすぐ送る（取り消しも） | FR8.4・FR8.5 |
| BR3.14 | 却下の理由をハンターに見せる。内容は直せない | FR9.2 |
| BR3.15 | 状態の読み出しで、本人にだけ取り消せる残りを返す | FR8.5 |
| BR4.2〜BR4.4 | U1 から引き継ぐ（一覧の読める人、ページ分け） | FR8.1・FR8.2・FR9.1 |
| BR4.5・BR4.7・BR4.8 | 絞り込みの決まりと、その実現の仕方、全件数 | FR8.1・FR8.2 |
| BR4.6 | 「重複の疑い」の印 | FR8.1・FR8.3 |
| BR4.9・BR4.10 | 日数と「7 日以上」の印、催促をしないこと | FR9.3 |

## Assumptions & Open Questions

- BR4.7・BR4.8 の読む上限 2,000 件は、1 回の読み出しの費用と待ち時間からの目安。数百件の試験運用では届かない。上限に達したときの表示（「2,000 件以上」）は Refined Mockups の言い回しに合わせる。 [assumption]
- BR4.9 の日数は 24 時間を 1 日として数える（暦日では数えない）。AC4.7.1（7 日 1 時間で付く）と AC4.7.2（6 日では付かない）がこの数え方を前提にしているため。 [assumption]
- BR3.9 の 10 秒はサーバーの時計で計る。画面は `undoUntil` を受け取ってボタンを隠すが、受け付けの判断はサーバーが行う（corner-checklist「Client-side rules」）。 [assumption]
- BR3.12 で名前が無いときの「依頼元の担当者」は、U1 で動いているコードの直しになる（U1 では利用者の ID が入っていた）。U3 の Code Generation で直す。すでに `dev` に保存された記録は作り直さず、読み出しのときに置き換える（レビュー R-02）。 [assumption]
- 利用者の ID の形（UUID）かどうかの判定は、8-4-4-4-12 桁の英数字とハイフンの並びで行う。人の表示名がこの形になることはない。 [assumption]
