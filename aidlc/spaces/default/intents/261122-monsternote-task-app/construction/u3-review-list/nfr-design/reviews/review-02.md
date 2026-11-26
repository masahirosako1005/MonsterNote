**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T08:15:14Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | construction/u3-review-list/nfr-design/performance-design.md > §1 却下・取り消しの時間の予算 | nfr-requirements/performance-requirements.md の NFR2.14 は「条件にした1回の書き換えだけなので承認より速い」という前提で目標を2秒（却下・承認の3秒より短い）に決めている。ところが performance-design.md §1 の設計は、取り消しも却下・承認と同じく「応答を返す前に知らせの送信（EventBridge、最大1.8秒）の完了を待つ」経路にしており、絶対の最悪値は約2.8秒で2秒の目標を超えると設計自身が認めている。その上で採用した「EventBridgeの0.5秒はやり直しの時間切れの上限であって普通の呼び出し時間ではないためp95では収まる」という理屈は、実測によらない希望的な整理であり、NFR2.14 が前提にしていた「書き換えだけだから速い」という根拠とは別物にすり替わっている。承認（NFR2.3）・却下（NFR2.13）はどちらも目標3秒に対し最悪値が同じく約3秒で収まっているのに対し、取り消しだけ目標（2秒）と設計の最悪値（2.8秒）の間に構造的な差があり、実測で崩れた場合に非同期化（設計のAssumptionsに記載のとおり）という作り直しが必要になる。 | NFR2.14 の目標値の根拠（書き換えだけだから承認より速い）と、実際に設計した処理経路（知らせの送信を待ってから応答する）を一致させる。具体的には、取り消しだけ知らせの送信を待たずに応答する設計に変えるか、nfr-requirements 側で NFR2.14 の根拠記述と目標値を設計の実態（却下・承認と同じ届け方で知らせを待つ）に合わせて改訂するかのいずれかを、dev の実測を待たずに今の時点で明記する。 | Resolved (reviewer) |
| R-02 | Minor | construction/u3-review-list/nfr-design/reliability-design.md > §1 同時の操作の確かさ（承認・却下） | 「`ReviewDecision` の行は `report.saved` の時点ですでに作られている前提（BR3.7）のため、…アトミック性（`if_not_exists`）は不要」と書いているが、BR3.7 は「確認の記録がまだない報告は操作を拒み404を返す」という却下系のハンドリングを定めた規則であり、「行は事前に必ず作られている」ことを保証する規則ではない（事前作成を定めているのは U1 の BR3.1〈report.savedを受けて確認中の記録を作る〉）。結論（UpdateExpression に if_not_exists が要らない）自体は正しいが、根拠として引用している規則が違う。 | 根拠の引用を BR3.7 から、U1 の該当規則（report.saved を受けて ReviewDecision を作る規則）に差し替える。 | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u3-review-list/nfr-design/reliability-design.md > §2「取り消しの知らせの届け方（NFR2.14との整合）」 | 取り消しの通知を1回だけ試して結果を待たずに応答する設計に変えたことで、通知が失敗したときの救済手段が「詳細（`GET /v1/reviews/{id}`）」にしか効かないのに、本文は「一覧・詳細の画面は次の読み出しで追いつく」と一覧にも効くかのように書いている。一覧（`GET /v1/catalog/reports`が読む`ReportListItem`）はBR4.1により`review.status-changed`の知らせだけから更新される仕組みで、直接`ReviewDecision`を読み直す経路を持たない。取り消しの通知が1回の送信で失敗すると、`ReportListItem`の状態（承認済み／却下のまま）を正しい`checking`に戻す手段がなく、しかも取り消し操作はその場で成立済みのため利用者が同じ取り消しをもう一度叩いても409（すでに確認中）になるだけで送り直しのきっかけにならない。承認・却下（最大3回のやり直しを待つ）に比べて取り消しは1回しか試さないため、この食い違いが表面化する確率はより高い。U1のreport.savedの失敗（eventSent=falseの送り直しの手順が明記されている）やaudit.recordedの失敗（受け入れたリスクと明記）と異なり、取り消しの通知失敗については一覧側の救済手段も「受け入れたリスク」としての明記もない。 | 一覧側が実際に追いつく仕組み（例えばReportListItemの更新をReviewDecisionのlastEventAt等と突き合わせて取りこぼしを検出する、または管理者がeventSent=falseの行を見つけて送り直す手順をU1のreport.savedと同様に用意する）を設計に足すか、それが無理なら「一覧は追いつかないことがある」受け入れたリスクとして明記し、「一覧・詳細の画面は次の読み出しで追いつく」という言い切りを訂正する。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u3-review-list/nfr-design/observability-design.md > §1「ログの項目」の「取り消し」行 | reliability-design.md §2で新しく導入した「取り消しの通知が1回失敗したら`eventSent=false`のまま応答し、ログに`EVENT_PUBLISH_FAILED`を記録する」という扱いが、observability-design.mdのログ項目の表（取り消しの行）にも、§2の「必要なときに見る値」のクエリ例にも反映されていない。このままでは取り消しの通知failureが実際に監視できる形になっていない。 | 「取り消し」のログ項目に`eventSent`／`EVENT_PUBLISH_FAILED`を追加し、§2のクエリ例（または一覧）に取り消しの通知失敗件数を数えられる項目を足す。 | New |

> R-01 Reviewer note: 取り消しだけ知らせの届け方を分け（送信を1回だけ試し、結果を待たず応答）、最悪値を書き換え（最大1秒）＋送信1回の時間切れ（0.5秒）＝約1.5秒に修正した。計算を検算したが誤りはなく（0.2秒以内／やり直し込みで最大1秒＋0.5秒＝1.5秒）、NFR2.14の2秒の目標に対して0.5秒の余裕がある。「書き換えだけだから承認・却下より速い」というNFR2.14自身の前提とも、修正後の経路の形が一致する。承認・却下はU1と同じ「送信を最大3回やり直してから応答する」届け方のまま変えておらず、NFR2.13（3秒以内）との整合も崩れていない。

> R-02 Reviewer note: reliability-design.mdの引用をBR3.7からU1のBR3.1に差し替え済み。U1のrules.md BR3.1（「report.savedの知らせでstatus=checkingの記録を作る」）を確認し、文言・趣旨とも一致している。BR3.7（「確認の記録がまだない報告は操作を拒み404を返す」）との混同は解消された。

### Validation Tool Results

このステージ定義に紐づく検証ツールの実行はなし（nfr-design向けの自動チェックツールは明示されていないため、手動でのクロスチェックのみ実施）。

| Tool | Result | Interpretation |
|---|---|---|
| — | 実行なし | 対象ステージに紐づく自動検証ツールの指定が見当たらなかったため、ファイル間の突き合わせ（nfr-requirements・rules.md・entities.mdとの照合）を手作業で行った |

### Summary

R-01・R-02はいずれも修正され、引用・時間予算の計算ともに正確で、NFR2.14自身の前提とも整合した。ただし取り消しの通知を「1回だけ・待たない」設計に変えたことの副作用として、一覧画面が通知の取りこぼしから自力で回復できない点を文書が過大に「追いつく」と言い切っており、ここをどう扱うかの明記が必要（Major 1件）。観測項目の抜け（Minor 1件）と合わせても、Critical 0件・Major 1件でREADYの基準は満たす。
