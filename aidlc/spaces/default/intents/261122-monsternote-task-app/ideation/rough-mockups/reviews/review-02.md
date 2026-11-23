## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-23T01:00:02Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H2 ホーム（「却下」の状態表示） | ハンターの一覧に「却下」が出るが、ハンターが却下の理由を見る画面も、撮り直して再報告する流れもない。R3 では却下理由を選ばせているのに、その理由の行き先がハンター側にない。F10 の結果がハンターに戻らず、利用者の「次にどうするか」が空白になる。 | ハンターが自分の報告を開いて状態と却下理由を見られること、再報告の入口（または「再報告は新規作成」と明記）を、画面案か Open Questions に追記する。 | Resolved (reviewer) |
| R-02 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H3〜H8 のステップ表示 | 図は「Step n/6」だが、クマのときは H4b が加わり 7 段階になる。H7 は番号がなく、H8 は「ステップ 6」とされている。進捗表示の数え方が揃っていない。 | クマのときの総ステップ数の表示（例: 1/7）を決めて書くか、「進捗は変わる」と注記する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/user-flow.md > 3. 画面の構成（末尾の段落） | 「どの画面もホームから 3 回以内の操作で届く」と書いているが、報告の作成は H3 から H8 まで 6 画面以上が続く。主張が自分の図と合わない。 | 「報告の作成を除く」と限定するか、主張を削る。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > R1、H4b、H2 と R2 の [Menu] | R1 は「H1 と同じ形」、H4b は「H3 と同じ形」とだけ書かれ、画面ごとのアクセシビリティの一行（見出しレベル・ランドマーク・最初のフォーカス）が独立していない。[Menu] の中身（ログアウトなど）も、どこにも定義がない。 | R1・H4b に一行ずつ書き足し、[Menu] に入る項目（最低限ログアウト）を一言で決める。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H6 と H7 | H7 の表示条件の判定が H6 の「送る」の後に起きるのか手前なのかが、図と文で読み取れない。user-flow では H6 の次の分岐になっている。確認中の待ち状態（読み込み表示）の記述もない。 | 「送る」を押した後に判定し、判定中は H6 のボタンに進行表示を出す、のように 1 行で順序を書く。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H7 重複の疑い | 「送るのをやめる」を選ぶとホームに戻る（user-flow.md）が、撮った写真と入力内容が残るのか消えるのか書かれていない。野外で撮った写真が消えると、ハンターには大きな損失になる。 | 要件の段階の確認事項として、中止時に下書きを残すか破棄するかを Open Questions に一行追記する。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H9 とホームの「確認中」 | 依頼元の確認でハンターに「確認中」のまま長く待たせる場合の扱い（目安の時間や催促）は画面案にない。ハンターが不安になる場面である。 | 最初の版では扱わないなら、その旨を Open Questions に一行書く。 | New |

> R-01 Reviewer note: H9「自分の報告の詳細」が追加された。状態と却下理由（R3 で選んだもの）を表示し、却下のときだけ「撮り直して新しく報告する」で H3 に進む。再報告は新規扱いで元の報告は却下のまま残る、と明記された。user-flow.md の「却下のあと」と依頼元の流れにも反映済み。

> R-02 Reviewer note: 通常 5、クマのとき 6 と決まり、H4b は 4/6、H5 は 4/5（クマは 5/6）、H6 は 5/5（クマは 6/6）と書かれた。H7・H8 は数えないと明記された。

> R-03 Reviewer note: 「報告の作成を除き」と限定され、主張が実態に合った。

> R-04 Reviewer note: R1・H4b にアクセシビリティの一行が入り、[Menu] の中身（ハンター側と依頼元側）が定義された。

> R-05 Reviewer note: H6 に「送る」の後に重複を判定し、判定中は「確認しています」を出す順序が書かれた。user-flow.md の図とも一致している。

### Summary

前回の指摘 R-01 から R-05 はすべて直っている。R-01 の却下理由と再報告の流れは H9 で閉じた。ハンター側 H1 から H9 と依頼元側 R1 から R3 は、Must 機能（F1、F2、F3、F4、F6、F9、F10、F13）と成功基準に対応している。空・エラー・読み込み中の状態とアクセシビリティも各画面に書かれている。残るのは要件の段階で決められる軽微な点だけで、エンジニアリング側が質問に戻らずに進められるため READY とする。
