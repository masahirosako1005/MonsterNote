## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-23T06:25:41Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US2.5 日時と場所の確認（AC2.5.1〜AC2.5.4）／Assumptions & Open Questions | FR2.14 は「送信の時刻」を基準に 7 日前・未来（5 分の誤差）を確かめるが、AC はすべて「内容の確認の画面を開く」時点の判定である。確認画面を開いたあと 6 日 23 時間 59 分から「送る」を押して 7 日を超える場合、送信に失敗して時間が経ってから「もう一度」を押す場合（US2.10 AC2.10.4）、サーバー側でも同じ確認をするかが書かれていない。受け入れ済みのリスク R-09（7 日の切り方）の扱いもストーリーに現れない。「未来」の 5 分の誤差の境界（例: 4 分後は可、6 分後は不可）と、ちょうど 7 日の境界も試験できない | 「送る」を押した時点（サーバーが受け付ける時点）でも同じ確認を行い、基準時刻が送信時刻であることを Given/When/Then で書く。5 分の誤差とちょうど 7 日の境界の AC を足す。R-09 をどのストーリーで扱うか、または範囲外とする理由を明記する | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US2.4 日時と場所を手で入れる（AC2.4.1〜AC2.4.3） | FR2.4 は「撮影日時」または「位置」のどちらかがない場合に手入力とするが、AC は位置がない場合だけである。日時がない写真（スクリーンショット、EXIF を消すブラウザ。仮定 A-6）の AC、日付と時刻を選んで入れる操作、日時が空白のままでは送れないこと、日時だけ・位置だけがない場合の組み合わせが試験できない | 日時がない写真の AC（空白表示、送信不可、入力後に送信可）を足す。日時と位置の両方がない場合と、片方だけの場合の期待結果を書く | New |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US2.10 内容を確かめて送る | 要件欄に FR2.8（二重送信の防止）を挙げているが、完全な報告の AC に「送信中はボタンが押せない」「報告が 1 件だけ」がない（US2.1 の AC2.1.2 は細い版の置き換え時に消える形になる） | US2.10 に AC2.1.2 と同じ内容の AC を足すか、US2.1 の AC を引き継ぐと明記する | New |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US2.2 写真を撮る・選ぶ（AC2.2.3） | 15 MB ちょうどの境界、JPEG・PNG・HEIC 以外の形式（PDF 以外の例）、JPEG に変えられない写真（FR2.12 の最後の文）の AC がない | 15 MB ちょうどは受け付ける・15 MB 超は断る、変換に失敗したとき理由を表示して選び直す、の AC を足す | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US1.1 AC1.1.4／US4.3／US6.1 AC6.1.4 | NFR4「承認・却下は依頼元だけ」を API で確かめる AC がない（ハンターが承認 API を直接呼ぶ場合。依頼元が管理者 API を呼ぶ場合は AC6.1.4 でカバー）。ハンターの承認 API 直接呼び出しは最も不正に近い経路 | US4.3 か US4.4 に、ハンターが承認・却下の API を直接呼んでも拒否される AC を足す | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US4.1 AC4.1.2／US4.4／US4.5 | FR8.1 の絞り込みは「確認中・承認・却下・重複の疑い・手入力」だが AC は「確認中」だけ。FR8.4 の理由 4 種のうち AC は 2 種だけ。US4.5 は題名が「承認・却下を取り消す」だが AC は承認だけで、却下の取り消しの AC がない | 絞り込みの残りの条件、却下理由 4 種、却下の取り消しの AC を足す（または代表例で足りる理由を書く） | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US4.3 AC4.3.3（🦴） | 細い版に入る US4.3 の AC が、細い版に入らない US4.5 の「取り消しの 10 秒」に依存している。細い版だけでは AC4.3.3 が試験できない | AC4.3.3 を US4.5 に移すか、細い版では「承認後は再操作できない」と書き換える | New |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US1.2〜US1.4 | 初回ログインでの順番（パスワード変更 → 同意 → 従事者番号）が AC1.3.1 の「従事者番号の画面に進む」しか書かれておらず、パスワード変更と同意の前後が決まっていない。パスワード規則も「英字だけ 8 文字」の拒否が試験できない | 初回ログインの順番を 1 つの AC で固定し、英字だけ・数字だけのパスワードを拒否する AC を足す | New |
| R-09 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US6.6 操作の記録を見る／US6.5 | NFR14 は「記録する」要件で、管理者が画面で見ることは求めていない（出典は personas の Q4 とのみ読める）。新しい要件の出典が明示されていない。また AC は承認とパスワード再設定の例だけで、送信・アカウント作成・無効化・設定変更・データ削除の記録が試験できない。「すべて削除」のあとに監査の記録が残るかも未定 | 画面で見る要件の出典を明記するか範囲外とする。NFR14 の列挙した操作を AC で網羅する。削除後の監査の記録の扱いを 1 つ決める | New |
| R-10 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US2.5・US2.9 の人物欄／US3.1・US3.3 | US2.5 は人物が P2 だが操作するのは P1 で、利用者の価値と操作の主体がずれている。US2.9 は人物が P1・P2 だが本文は P1 だけ。US3.1・US3.3 は「P2 として…見つけたい」だが中身はサーバーの判定で、試験の主体が分かりにくい | 操作する人物と価値を受ける人物を分けて書く（例: 「P1 として、…を送れないように案内されたい。なぜなら P2 の確認の手間が減るから」） | New |
| R-11 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/stories.md > US7.1 AC7.1.2／US7.2 AC7.2.3 | 「縮小・切り抜き」で同じとみなす類似度の基準がなく、試験できない。AC7.2.3 は Given/When/Then の試験ではなく範囲の決定の記述 | 類似度の基準（または試験用の写真セット）を決める。AC7.2.3 は AC から外して前提・範囲の注記に移す（Should のため後続でもよい） | New |

### Summary

37 件のストーリーは要件の FR・NFR をおおむね漏れなく覆い（traceability の通過とも整合）、細い版の 6 件は team-practices の「ログイン → 写真 1 枚の報告 → 依頼元が承認」と一致し、境界値の入った Given/When/Then になっていて実装に進める水準にある。ただし日時の確認（送信時刻基準・サーバー側・R-09）と、日時がない写真の手入力の 2 点は、実装前に AC を足しておくことを勧める。Critical はなく Major は 2 件のため READY とする。
