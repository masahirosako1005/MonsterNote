## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T09:43:45Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-spec.md > UC2 手順 6（確かめる順番）, rules.md > BR2.3 と BR2.6 | 確認の順番が「写真（BR2.3）→ 項目 → 送信のキー（BR2.6）」になっている。報告が保存されると写真に reportId が入るため、時間切れ後の「もう一度」（同じ送信のキー）は BR2.3 で先に 422 になり、BR2.6 の「200 で同じ reportId を返す」に到達しない。二重送信の角のケース（functional-spec 6 節）と「もう一度は同じキーで送る」の流れが成り立たない | 送信のキーの確認（既存なら 200 で同じ reportId、処理中なら 409）を写真の確認より先に置くよう UC2 手順 6 と BR2.3・BR2.6 の適用順を直す。再送のときは写真が結び付き済みでも成功とする規則を書く | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/entities.md > ReviewDecision, rules.md > BR3.5 | BR3.5 は「報告が自分のもの」を判定するが、ReviewDecision に hunterAccountId がなく、Review が持つ情報だけでは判定できない。Review から Reporting を呼ぶ約束（C1〜C17）は contract-summary にもない（知らせで動く処理は他の部品を呼ばない）。このままでは実装者が持ち主の判定方法を推測するしかない | ReviewDecision に hunterAccountId を `report.saved` から写して持たせるか、判定の方法を別に決めて entities.md と rules.md に書く | New |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-spec.md > UC4 手順 2〜3, UC6, rules.md > BR3.3 | 一覧の行（ReportCatalog）と確認中の記録（Review）は別々の知らせで作られる。依頼元が一覧で行を見てから承認するとき、Review の記録がまだない場合がありうる（BR3.1 の処理が遅れた場合）。BR3.3 の「確認中でなければ 409」は記録なしを扱わず、結果が決まっていない（承認が落ちるのか、404 か、待つのか） | 記録がないときの振る舞い（例: 404 または再試行を促す 409 と画面の文言）を BR3.3 と UC4、frontend-components.md の DecisionBar に追加する。承認後に遅れて届く report.saved が status を戻さないことも明記する | New |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR4.2・BR4.3, functional-spec.md > UC3 手順 2, contract-summary.md 7 節（C4 の未解決の点） | contract-summary は C4 のページ分けの位置（cursor）の形と全件数の数え方を Functional Design で決めると書いたが、U1 のどの文書にも決めがない（「次のページ」とだけある）。U1 は 50 件のページ分けを含む。並び順の（submittedAt, reportId）を cursor にどう持つか、全件数を返すか、承認で行が動いたときの扱いが未定 | cursor の中身（最後の行の submittedAt と reportId）、全件数を U1 で返すかどうか、ページ内容が変わるときの扱いを BR4.2・BR4.3 に追記する | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR2.2、functional-spec.md > 写真の状態 | pending → uploaded に移る規則がない（complete を受けたとき、保存場所に実物があるか、宣言した大きさ・形式と一致するかを確かめる規則）。直接アップロードのため、宣言の sizeBytes が実物の 15 MB 制限を守る保証がない。また状態図に linked があるが、Photo.uploadStatus の許す値は pending・uploaded だけ | complete の確認規則（実物の存在・大きさ・形式、404 の条件）を BR2 に足し、linked は reportId の有無から導く状態と明記して状態図と entities を合わせる | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/rules.md > BR2.5・BR2.4 と contract-summary.md C2 `POST /v1/reports` | 約束の POST /v1/reports は capturedAt と location の source を exif・manual としているが、U1 は device を送る。また BR2.4 の入力不足は 400、BR2.3 の写真の誤りは 422 VALIDATION_FAILED と、約束の状態番号の使い分け（400 は形の誤り、422 は業務の決まり）とずれている。スマホの時刻が未来・極端に古い場合の確認も U1 にない | 約束の source に device を足す変更を共通の約束の置き場側で行うことを明記し、状態番号と code を約束に合わせる。端末の時刻の妥当性の扱い（確認する・しない）を決めて書く | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-spec.md > UC1 手順 3、UC2 手順 7 | admin のログイン先が未定義（U1 では作れないなら、そう書く）。また「保存・写真の結び付け・知らせの送信」が一部だけ成功したとき（保存したが知らせが出ない）、報告が一覧に永久に出ない。確実に届けることは NFR Design に回しているが、機能の要件としては書かれていない | admin は U1 で作れない・使わないと明記する。「保存した報告は必ず知らせが出る」ことを機能の要件として書き、方法だけを NFR Design に委ねる | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| sensors (traceability.json など、決定的な検査) | 依頼文のとおり PASS | 構造の検査は通っている。上の指摘は構造ではなく、規則の間の整合と順序の問題 |

### Summary

構成と規則の ID の対応は整っているが、冪等な再送を壊す確認の順番（BR2.3 が BR2.6 より先）、Review が持ち主を判定できないデータの欠け、記録がない承認の扱い、cursor の未決定という、実装者が推測せざるを得ない欠陥が 4 件ある。これらを直せば READY に近づく。
