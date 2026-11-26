**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | `construction/u3-review-list/functional-design/rules.md` > BR3.9（取り消し） | 承認・却下（BR3.3／UC17）は「確認中であることを条件にした 1 回の書き換え」と明記し、読んでから書く実装を明示的に禁じているのに、取り消し（BR3.9）には同じ宣言がない。BR3.9 の記述は「IF decidedByAccountId=操作する人 AND 今の時刻 ≤ undoUntil THEN 確認中に戻す」という順次の条件判定として書かれており、本人の二重クリックなど取り消しが 2 回連続で届いた場合、1 回目の成功で decidedByAccountId・undoUntil が空になった後、2 回目の判定は「IF decidedByAccountId≠操作する人 THEN 403」に落ち、実際には同一人物の再操作なのに「本人ではない」という誤った 403 を返しうる（AC4.5.3 が本来区別すべき「本人か否か」と「期限切れか否か」の意味が壊れる）。 | 取り消しも承認・却下と同じく、現在の状態（status≠checking かつ decidedByAccountId=操作する人）を条件にした 1 回の原子的な書き換えで行うことを明記し、条件に合わない場合の応答（本人以外／期限切れ／二重操作）を整理すること。 | Resolved (reviewer) |
| R-02 | Major | `construction/u3-review-list/functional-design/entities.md` の D-4（`functional-spec.md` §7） | D-4 は「`decidedByName` が無いときに利用者の ID を入れていたのを『依頼元の担当者』に直す」とコードの修正だけを宣言しているが、これは今後の新規の確定にしか効かない。AWS dev にはすでに U1 で確定した `ReviewDecision` 行が存在しており（タスクの前提）、ID トークンに `name` クレームがなかったケースがあれば、その行の `decidedByName` には UUID がすでに保存されたままになる。この値は AC4.6.1 の 409 応答や BR3.14 のハンター向け却下理由表示で今後も読み出され続けるため、D-4 だけでは「利用者の ID を画面に出さない」という Q5 の目的を既存データについて達成できない。 | 既存行の `decidedByName` を点検し、UUID 形式の値が残っていれば「依頼元の担当者」へ補正するデータ移行（または Code Generation での一括修正）を設計に明記すること。 | Resolved (reviewer) |
| R-03 | Major | `construction/u3-review-list/functional-design/traceability.json` > `upstream_ids` / `coverage`（AC4.1.1, AC4.1.3, AC4.1.4） | `inception/units-generation/unit-of-work.md`（U3 の境界）と `unit-of-work-story-map.md`（US4.1 の行注記「U3 は絞り込み（AC4.1.2）」）はいずれも、US4.1 のうち U3 が受け持つのは AC4.1.2（絞り込み）だけで、AC4.1.1（新しい順の全件表示）・AC4.1.3（ページ分け）・AC4.1.4（0 件表示）は U1 の範囲と明記している。ところが本 Unit の `traceability.json` はこの 3 件も `upstream_ids` に含め、`status: "OK"` として U3 の成果に数えている。U1 側の traceability で既に満たされているはずの受け入れ基準を U3 が重複して「達成」と申告しており、Code Generation 段階でどの Unit がどのテストを書くべきかの判断を誤らせる。 | U3 の `upstream_ids` は U3 が新たに受け持つ受け入れ基準（AC4.1.2、US4.4〜US4.7、US5.2・US5.3 系）に限定し、U1 から引き継ぐだけの BR4.2〜BR4.4 の根拠は reverse 側または注記で「U1 を参照」と明記するに留めること。 | Resolved (reviewer) |
| R-04 | Minor | `construction/u3-review-list/functional-design/frontend-components.md` §3（画面が持つ状態）／`rules.md` BR3.9 | 「取り消す」ボタンの表示は、PUT 確定の応答で受け取った `undoUntil` を画面の状態として持つだけで、「10 秒を過ぎたとき、取り消したとき、画面を離れたとき」に消えると明記されている。つまり本人が確定直後に別画面へ移動して戻る、あるいは一覧から詳細を開き直すと、10 秒以内であっても「取り消す」ボタンは二度と出ない（GET `/v1/reviews/{reportId}` の応答に取り消し可否を復元する情報が定義されていない）。AC4.5.1〜AC4.5.3 の受け入れ基準はこの操作パターンを明示的には問わないため致命的ではないが、意図した仕様なのか単なる書き漏れなのかが分からない。 | GET 応答で取り消し可否を本人にだけ復元するか、それとも「確定直後の画面を離れると取り消せなくなる」という制約を意図した仕様として明記するかを、`rules.md` または `functional-spec.md` の Assumptions に残すこと。 | Resolved (reviewer) |
| R-05 | Minor | `construction/u3-review-list/functional-design/rules.md` BR3.9 の 2 重操作時の応答 | 上の Major 指摘（本人の二重取り消し）と関連し、取り消しの二重送信（ネットワーク再送や二重クリック）が起きた場合に `review.status-changed` が 2 回送られる可能性があるが、これに対する冪等性の扱い（2 回目は無視する、あるいは結果が同じなら許容する、など）が rules.md に書かれていない。U2 の `duplicate.suspected` 側は `processedEventIds` で明示的に二重配信を無視しているのに対し、Review が送る `review.status-changed` の送信側の重複排除方針が本書には記載がなく、実装者が独自に判断することになる。 | 送信側の重複排除方針（例: 同一の確定操作からは 1 回しか送らない）を明記すること。 | Resolved (reviewer) |
| R-06 | Major | `construction/u3-review-list/functional-design/rules.md` BR3.9（`violation` 行）と `construction/u3-review-list/functional-design/functional-spec.md` §7（約束との違い） | R-01 の修正で `POST /v1/reviews/{reportId}/decision/undo` は新しく `409 ALREADY_UNDONE` を返すようになったが、`inception/contract-design/contract-summary.md` の C3 はこのエンドポイントの応答を `200`・`403（本人ではない）`・`409（期限切れ。UNDO_EXPIRED）` としか定義しておらず、`ALREADY_UNDONE` という別の 409 の中身は約束にない。ところが `functional-spec.md` §7 の「約束との違い」表は D-1〜D-5 のいずれもこの変更を指しておらず（D-5 は GET 応答への `undoUntil` 追加だけを扱う）、新しい応答コードが約束との差分として宣言されていない。`frontend-components.md` §5「入力の確かめ方」の「取り消しの期限」行も `409（期限切れ）` しか書いておらず、`UndoBar` の説明にも `ALREADY_UNDONE` の扱いがない。 | `functional-spec.md` §7 に D-6 として「約束 C3（`POST /v1/reviews/{reportId}/decision/undo`）: 409 の中身に `ALREADY_UNDONE`（すでに確認中に戻っている）を追加する」を足し、`frontend-components.md` §5 または `UndoBar` の説明に、この応答が来たときの画面の扱い（例: 何もしない、またはすでに確認中である旨を出す）を一行加えること。 | Resolved (reviewer) |

> R-06 Reviewer note: `functional-spec.md` §7 に D-6（`POST /v1/reviews/{reportId}/decision/undo` が `409 ALREADY_UNDONE` を新たに返す。C3 はこれまで `403`・`409 UNDO_EXPIRED` だけだった、という契約差分）が追加された。`functional-spec.md` §6 の二重押しの角のケース行、`frontend-components.md` §5 の新しい行、`rules.md` BR3.9 のロジックの 4 か所がいずれも「`ALREADY_UNDONE` は約束にない応答で D-6 に記録した」「画面はエラーを出さず確認中の状態を出し直す」で一致しており、矛盾はない。画面の扱い（ボタンを押せない状態にし、エラー表示なしで確認中の状態を出し直す）は AC4.5.1〜AC4.5.3 のいずれとも矛盾しない。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージに validation tool の指定なし） | 実行せず | `functional-spec.md` §6・§7、`frontend-components.md` §5、`rules.md` BR3.9 の 4 箇所を再読し、D-6 の文言・応答コード・画面の扱いが互いに一致していること、および iteration 2 で確認した R-01〜R-05 の修正箇所が変更されていないことを手作業で確認した。 |

### Summary

R-06 の修正は `functional-spec.md`（§6・§7）・`frontend-components.md`（§5）・`rules.md`（BR3.9）の 4 か所すべてに一貫して反映されており、契約差分の宣言（D-6）・角のケースの記述・画面の振る舞いのいずれも食い違いがなく、AC4.5.1〜AC4.5.3 とも矛盾しない。R-01〜R-05 の修正も変更されずに維持されていることを再確認した。新たに持ち込まれた問題は見つからなかったため、Critical 0 件・Major 0 件（すべて Fixed）で READY とする。
