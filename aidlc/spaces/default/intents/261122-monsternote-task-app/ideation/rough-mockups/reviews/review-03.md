## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-23T01:03:36Z
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
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H7 重複の疑い | 「送るのをやめる」を選ぶとホームに戻る（user-flow.md）が、撮った写真と入力内容が残るのか消えるのか書かれていない。野外で撮った写真が消えると、ハンターには大きな損失になる。 | 要件の段階の確認事項として、中止時に下書きを残すか破棄するかを Open Questions に一行追記する。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H9 とホームの「確認中」 | 依頼元の確認でハンターに「確認中」のまま長く待たせる場合の扱い（目安の時間や催促）は画面案にない。ハンターが不安になる場面である。 | 最初の版では扱わないなら、その旨を Open Questions に一行書く。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > R3 報告の詳細と確認 / user-flow.md > Assumptions & Open Questions | 却下の理由に「その他」があるが、自由記入の有無が未定。ハンターが H9 で「その他」と表示されても、何を直せばよいか分からない恐れがある。 | 要件の段階で、「その他」のときは短い自由記入を必須にするかどうかを決める。決めるまでの前提を Assumptions に 1 行足す。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/ideation/rough-mockups/wireframes.md > H7 重複の疑い | 下書きはスマホに残る前提なので、端末の紛失・機種変更・ブラウザのデータ削除で消える。野外の写真を守る目的との関係が書かれていない。 | 下書きが端末内だけであることを前提として Assumptions に書くか、要件の段階で扱いを決める。 | New |

> R-06 Reviewer note: H7 に、「送るのをやめる」を選ぶと写真と入力内容を下書きとしてスマホに残し、ホームの一覧に「下書き」と表示し、開くと H6 から再開でき、確認つきの「削除」で消せる、と書かれた。user-flow.md の流れ図と表にも反映されている。

> R-07 Reviewer note: H2 と H9 に「送ってから n 日」を表示し、7 日を過ぎたら依頼元に連絡するよう案内する（アプリからの催促はしない）と書かれた。R2 には依頼元向けの「7 日以上」の印と古い順の並びもある。7 日は仮の値として Assumptions に明記されている。

### Summary

前回の 2 件の指摘（中止時の下書きの扱い、確認中の長期化への対応）はどちらも画面案と流れに反映され、整合している。Critical と Major は見当たらず、残るのは要件の段階で決められる Minor の 2 件だけなので、開発側が確認なしに次へ進める状態。
