**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | `construction/u3-review-list/functional-design/rules.md` > BR3.9（取り消し） | 承認・却下（BR3.3／UC17）は「確認中であることを条件にした 1 回の書き換え」と明記し、読んでから書く実装を明示的に禁じているのに、取り消し（BR3.9）には同じ宣言がない。BR3.9 の記述は「IF decidedByAccountId=操作する人 AND 今の時刻 ≤ undoUntil THEN 確認中に戻す」という順次の条件判定として書かれており、本人の二重クリックなど取り消しが 2 回連続で届いた場合、1 回目の成功で decidedByAccountId・undoUntil が空になった後、2 回目の判定は「IF decidedByAccountId≠操作する人 THEN 403」に落ち、実際には同一人物の再操作なのに「本人ではない」という誤った 403 を返しうる（AC4.5.3 が本来区別すべき「本人か否か」と「期限切れか否か」の意味が壊れる）。 | 取り消しも承認・却下と同じく、現在の状態（status≠checking かつ decidedByAccountId=操作する人）を条件にした 1 回の原子的な書き換えで行うことを明記し、条件に合わない場合の応答（本人以外／期限切れ／二重操作）を整理すること。 | Resolved (reviewer) |
| R-02 | Major | `construction/u3-review-list/functional-design/entities.md` の D-4（`functional-spec.md` §7） | D-4 は「`decidedByName` が無いときに利用者の ID を入れていたのを『依頼元の担当者』に直す」とコードの修正だけを宣言しているが、これは今後の新規の確定にしか効かない。AWS dev にはすでに U1 で確定した `ReviewDecision` 行が存在しており（タスクの前提）、ID トークンに `name` クレームがなかったケースがあれば、その行の `decidedByName` には UUID がすでに保存されたままになる。この値は AC4.6.1 の 409 応答や BR3.14 のハンター向け却下理由表示で今後も読み出され続けるため、D-4 だけでは「利用者の ID を画面に出さない」という Q5 の目的を既存データについて達成できない。 | 既存行の `decidedByName` を点検し、UUID 形式の値が残っていれば「依頼元の担当者」へ補正するデータ移行（または Code Generation での一括修正）を設計に明記すること。 | Resolved (reviewer) |
| R-03 | Major | `construction/u3-review-list/functional-design/traceability.json` > `upstream_ids` / `coverage`（AC4.1.1, AC4.1.3, AC4.1.4） | `inception/units-generation/unit-of-work.md`（U3 の境界）と `unit-of-work-story-map.md`（US4.1 の行注記「U3 は絞り込み（AC4.1.2）」）はいずれも、US4.1 のうち U3 が受け持つのは AC4.1.2（絞り込み）だけで、AC4.1.1（新しい順の全件表示）・AC4.1.3（ページ分け）・AC4.1.4（0 件表示）は U1 の範囲と明記している。ところが本 Unit の `traceability.json` はこの 3 件も `upstream_ids` に含め、`status: "OK"` として U3 の成果に数えている。U1 側の traceability で既に満たされているはずの受け入れ基準を U3 が重複して「達成」と申告しており、Code Generation 段階でどの Unit がどのテストを書くべきかの判断を誤らせる。 | U3 の `upstream_ids` は U3 が新たに受け持つ受け入れ基準（AC4.1.2、US4.4〜US4.7、US5.2・US5.3 系）に限定し、U1 から引き継ぐだけの BR4.2〜BR4.4 の根拠は reverse 側または注記で「U1 を参照」と明記するに留めること。 | Resolved (reviewer) |
| R-04 | Minor | `construction/u3-review-list/functional-design/frontend-components.md` §3（画面が持つ状態）／`rules.md` BR3.9 | 「取り消す」ボタンの表示は、PUT 確定の応答で受け取った `undoUntil` を画面の状態として持つだけで、「10 秒を過ぎたとき、取り消したとき、画面を離れたとき」に消えると明記されている。つまり本人が確定直後に別画面へ移動して戻る、あるいは一覧から詳細を開き直すと、10 秒以内であっても「取り消す」ボタンは二度と出ない（GET `/v1/reviews/{reportId}` の応答に取り消し可否を復元する情報が定義されていない）。AC4.5.1〜AC4.5.3 の受け入れ基準はこの操作パターンを明示的には問わないため致命的ではないが、意図した仕様なのか単なる書き漏れなのかが分からない。 | GET 応答で取り消し可否を本人にだけ復元するか、それとも「確定直後の画面を離れると取り消せなくなる」という制約を意図した仕様として明記するかを、`rules.md` または `functional-spec.md` の Assumptions に残すこと。 | Resolved (reviewer) |
| R-05 | Minor | `construction/u3-review-list/functional-design/rules.md` BR3.9 の 2 重操作時の応答 | 上の Major 指摘（本人の二重取り消し）と関連し、取り消しの二重送信（ネットワーク再送や二重クリック）が起きた場合に `review.status-changed` が 2 回送られる可能性があるが、これに対する冪等性の扱い（2 回目は無視する、あるいは結果が同じなら許容する、など）が rules.md に書かれていない。U2 の `duplicate.suspected` 側は `processedEventIds` で明示的に二重配信を無視しているのに対し、Review が送る `review.status-changed` の送信側の重複排除方針が本書には記載がなく、実装者が独自に判断することになる。 | 送信側の重複排除方針（例: 同一の確定操作からは 1 回しか送らない）を明記すること。 | Resolved (reviewer) |
| R-06 | Major | `construction/u3-review-list/functional-design/rules.md` BR3.9（`violation` 行）と `construction/u3-review-list/functional-design/functional-spec.md` §7（約束との違い） | R-01 の修正で `POST /v1/reviews/{reportId}/decision/undo` は新しく `409 ALREADY_UNDONE` を返すようになったが、`inception/contract-design/contract-summary.md` の C3 はこのエンドポイントの応答を `200`・`403（本人ではない）`・`409（期限切れ。UNDO_EXPIRED）` としか定義しておらず、`ALREADY_UNDONE` という別の 409 の中身は約束にない。ところが `functional-spec.md` §7 の「約束との違い」表は D-1〜D-5 のいずれもこの変更を指しておらず（D-5 は GET 応答への `undoUntil` 追加だけを扱う）、新しい応答コードが約束との差分として宣言されていない。`frontend-components.md` §5「入力の確かめ方」の「取り消しの期限」行も `409（期限切れ）` しか書いておらず、`UndoBar` の説明にも `ALREADY_UNDONE` の扱いがない。 | `functional-spec.md` §7 に D-6 として「約束 C3（`POST /v1/reviews/{reportId}/decision/undo`）: 409 の中身に `ALREADY_UNDONE`（すでに確認中に戻っている）を追加する」を足し、`frontend-components.md` §5 または `UndoBar` の説明に、この応答が来たときの画面の扱い（例: 何もしない、またはすでに確認中である旨を出す）を一行加えること。 | New |

> R-01 Reviewer note: `rules.md` BR3.9 は、承認・却下（BR3.3）と同じ「現在の状態を条件にした 1 回の原子的な書き換え」として取り消しを再定義し、書き換えが失敗したときだけ記録を読み直して `status=checking → 409 ALREADY_UNDONE`・`本人でない → 403`・`期限切れ → 409 UNDO_EXPIRED` の順で理由を返すようにした。本人の二重操作が誤って「本人ではない」になる経路は塞がれている。`functional-spec.md` UC16 と §6 の角のケース表も整合している。

> R-02 Reviewer note: `rules.md` BR3.12 に読み出し時のガードが追加され、`decidedByName` が UUID の形（8-4-4-4-12）に見える値は「依頼元の担当者」に置き換えて返す。U1 がすでに `dev` に書き込んだ行もデータを作り直さずに保護される。UUID 判定方法が Assumptions に明記されている。

> R-03 Reviewer note: `traceability.json` で AC4.1.1・AC4.1.3・AC4.1.4 が `status: "N/A"`・`target: "delivered by u1-skeleton（…）"` に変わり、U3 の `coverage` で `OK` となるのは AC4.1.2 だけになった。`reverse` に BR4.2・BR4.4 の対応行が足され、U1 側の責任の所在が明記されている。

> R-04 Reviewer note: 新しい BR3.15 が `GET /v1/reviews/{reportId}` の応答で、本人かつ 10 秒以内のときだけ `undoUntil` を返すと定め、`functional-spec.md` UC16・`frontend-components.md` §3 の `UndoBar` 記述も「画面を開き直したときも状態の読み出しから受け取り直す」に揃えて書き換えられている。AC4.5.3（他人には出さない）は壊れていない。

> R-05 Reviewer note: `rules.md` BR3.13 に「書き換えが成功したときだけ `review.status-changed` を送る」という条件が足され、二重送信や再送で書き換えが失敗した操作からは知らせが出ないことが明記された。1 回の状態変化につき知らせが 1 回になる。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージに validation tool の指定なし） | 実行せず | 前回の指摘 R-01〜R-05 の修正箇所（`rules.md` BR3.9・BR3.12・BR3.13・BR3.15、`functional-spec.md` UC16・§7 D-5、`frontend-components.md` §3、`traceability.json`）を再読し、`inception/contract-design/contract-summary.md` の C3 の記載と突き合わせる手作業の検証を行った。 |

### Summary

iteration 1 の Major 3 件・Minor 2 件はすべて修正が確認でき、取り消しの原子性（R-01）・UUID 露出の読み出し側ガード（R-02）・traceability の二重計上の解消（R-03）・画面を離れて戻ったときの取り消し復元（R-04）・知らせの送信側の重複排除（R-05）はいずれも設計として健全である。ただし R-01 の修正自体が新しい応答コード `409 ALREADY_UNDONE` を導入しており、これが約束（contract-summary C3）との差分として `functional-spec.md` §7 に宣言されていない新規の指摘が 1 件見つかった。Critical 0 件・Major 1 件であり、READY の基準（Critical 0 件かつ Major 2 件以下）は満たすため READY とするが、この新規指摘は Code Generation に進む前に反映することを求める。
