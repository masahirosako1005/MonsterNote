## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T09:46:57Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-spec.md > UC2 手順 6（確かめる順番）, rules.md > BR2.3 と BR2.6 | 確認の順番が「写真（BR2.3）→ 項目 → 送信のキー（BR2.6）」になっている。報告が保存されると写真に reportId が入るため、時間切れ後の「もう一度」（同じ送信のキー）は BR2.3 で先に 422 になり、BR2.6 の「200 で同じ reportId を返す」に到達しない。二重送信の角のケース（functional-spec 6 節）と「もう一度は同じキーで送る」の流れが成り立たない | 送信のキーの確認（既存なら 200 で同じ reportId、処理中なら 409）を写真の確認より先に置くよう UC2 手順 6 と BR2.3・BR2.6 の適用順を直す。再送のときは写真が結び付き済みでも成功とする規則を書く | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/entities.md > ReviewDecision, rules.md > BR3.5 | BR3.5 は「報告が自分のもの」を判定するが、ReviewDecision に hunterAccountId がなく、Review が持つ情報だけでは判定できない。Review から Reporting を呼ぶ約束（C1〜C17）は contract-summary にもない（知らせで動く処理は他の部品を呼ばない）。このままでは実装者が持ち主の判定方法を推測するしかない | ReviewDecision に hunterAccountId を `report.saved` から写して持たせるか、判定の方法を別に決めて entities.md と rules.md に書く | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-spec.md > UC4 手順 2〜3, UC6, rules.md > BR3.3 | 一覧の行（ReportCatalog）と確認中の記録（Review）は別々の知らせで作られる。依頼元が一覧で行を見てから承認するとき、Review の記録がまだない場合がありうる（BR3.1 の処理が遅れた場合）。BR3.3 の「確認中でなければ 409」は記録なしを扱わず、結果が決まっていない（承認が落ちるのか、404 か、待つのか） | 記録がないときの振る舞い（例: 404 または再試行を促す 409 と画面の文言）を BR3.3 と UC4、frontend-components.md の DecisionBar に追加する。承認後に遅れて届く report.saved が status を戻さないことも明記する | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR4.2・BR4.3, functional-spec.md > UC3 手順 2, contract-summary.md 7 節（C4 の未解決の点） | contract-summary は C4 のページ分けの位置（cursor）の形と全件数の数え方を Functional Design で決めると書いたが、U1 のどの文書にも決めがない（「次のページ」とだけある）。U1 は 50 件のページ分けを含む。並び順の（submittedAt, reportId）を cursor にどう持つか、全件数を返すか、承認で行が動いたときの扱いが未定 | cursor の中身（最後の行の submittedAt と reportId）、全件数を U1 で返すかどうか、ページ内容が変わるときの扱いを BR4.2・BR4.3 に追記する | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR2.2、functional-spec.md > 写真の状態 | pending → uploaded に移る規則がない（complete を受けたとき、保存場所に実物があるか、宣言した大きさ・形式と一致するかを確かめる規則）。直接アップロードのため、宣言の sizeBytes が実物の 15 MB 制限を守る保証がない。また状態図に linked があるが、Photo.uploadStatus の許す値は pending・uploaded だけ | complete の確認規則（実物の存在・大きさ・形式、404 の条件）を BR2 に足し、linked は reportId の有無から導く状態と明記して状態図と entities を合わせる | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR2.5・BR2.4 と contract-summary.md C2 `POST /v1/reports` | 約束の POST /v1/reports は capturedAt と location の source を exif・manual としているが、U1 は device を送る。また BR2.4 の入力不足は 400、BR2.3 の写真の誤りは 422 VALIDATION_FAILED と、約束の状態番号の使い分け（400 は形の誤り、422 は業務の決まり）とずれている。スマホの時刻が未来・極端に古い場合の確認も U1 にない | 約束の source に device を足す変更を共通の約束の置き場側で行うことを明記し、状態番号と code を約束に合わせる。端末の時刻の妥当性の扱い（確認する・しない）を決めて書く | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-spec.md > UC1 手順 3、UC2 手順 7 | admin のログイン先が未定義（U1 では作れないなら、そう書く）。また「保存・写真の結び付け・知らせの送信」が一部だけ成功したとき（保存したが知らせが出ない）、報告が一覧に永久に出ない。確実に届けることは NFR Design に回しているが、機能の要件としては書かれていない | admin は U1 で作れない・使わないと明記する。「保存した報告は必ず知らせが出る」ことを機能の要件として書き、方法だけを NFR Design に委ねる | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR4.2 logic と BR4.4 logic | 並び順の同順位の扱いが食い違っている。BR4.2 は「同じなら reportId」とだけ書き、BR4.4 は「reportId の大きい順」と書く。 | BR4.2 の記述を BR4.4 に合わせて「reportId の大きい順」にする。Code Generation までに直せばよく、ブロックはしない。 | New |

> R-01 Reviewer note: BR2.6 と functional-spec UC2 の 6 で、送信のキーを証明の直後・ほかの確認より先に確かめ、既存なら 200 で同じ reportId を返す形になった。保存成功後の再送で 422 にならない。

> R-02 Reviewer note: entities.md の ReviewDecision に hunterAccountId を追加し、BR3.1 が report.saved から写す。BR3.5 は Review 内の記録だけで判断し、Reporting を呼ばない。

> R-03 Reviewer note: BR3.7 が 404 REVIEW_NOT_READY とメッセージを定義し、UC4 の 2 と DecisionBar（frontend-components.md）にも反映された。記録がないと承認は通らないため、遅れて届く report.saved が状態を戻すことはない。

> R-04 Reviewer note: BR4.4 で並び順、cursor（最後の行の submittedAt と reportId）、全件数、末尾での空 cursor、壊れた cursor の 400 を定義した。UC3 と整合している。

> R-05 Reviewer note: BR2.9 が complete 時の検証を定め、Photo の状態は pending と uploaded に揃った。図、entities.md、規則が一致している。

> R-06 Reviewer note: functional-spec 7 節で device の追加を「足すだけの変更」と明記し、日時はサーバー受付時刻にした。400（入力の形）と 422（業務の決まり）の使い分けも contract-summary の表と合っている。

> R-07 Reviewer note: UC7 と BR5.1 で U1 は admin を作らないと明記した。BR2.7 が「保存した報告は必ず知らせを送る」を要件として述べている。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| sensors（traceability など） | 引き渡しの記載どおり pass | 追加の確認は不要 |

### Summary

前回の Major 4 件と Minor 3 件はすべて直っており、開発者が推測なしで実装できる状態である。残るのは BR4.2 と BR4.4 の同順位表記の食い違いという Minor 1 件だけである。
