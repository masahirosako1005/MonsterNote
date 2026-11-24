**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | `construction/u2-report-duplicate/functional-design/functional-spec.md` > UC11「重複の疑いの判定」手順 6、`entities.md` の `Report.duplicateSuspected` | `Report.duplicateSuspected`（Reporting が持つ報告そのものの項目）を「DuplicateDetection が立てる」と UC11 の手順 6 に書いてあるが、DuplicateDetection から Reporting へ書き戻す経路が存在しない。`contract-summary.md` の C14（`duplicate.suspected`）は DuplicateDetection → ReportCatalog（U3）だけで、Reporting 向けの知らせも API 呼び出しも定義されていない。`components.md` の Reporting の `depends_on`／DuplicateDetection の `dependents` にも「DuplicateDetection が Reporting のデータを更新する」という向きの依存は無い。つまり `GET /v1/reports/{reportId}`（Reporting が持つ）から返る `duplicateSuspected` は、送信直後の初期値 `false` のまま一生変わらない、作れないデータ項目になっている。実際の重複表示は C5 `GET /v1/duplicates/{reportId}`（DuplicateDetection）と ReportCatalog の `ReportListItem.duplicateSuspected`（C14 で正しく更新される）で成立しており、`Report.duplicateSuspected` は二重管理のうえ片方が永遠に腐る設計になっている。 | `Report.duplicateSuspected` 項目を entities.md から削除するか、「表示には使わない・常に false のままでよい参考値」と明記する。あるいは、DuplicateDetection から Reporting への書き戻しの経路（新しい内部 API か知らせ）を正式に追加し、contract-summary・components.md 側も合わせて直す。UC11 の手順 6 の主語（誰が・どの API/知らせで Report を書き換えるのか）を具体的に書く。 | New |
| R-02 | Critical | `construction/u2-report-duplicate/functional-design/rules.md` の BR8.7、`functional-spec.md` の UC12 | `review.status-changed`（却下）が、同じ報告の `report.saved` より先に DuplicateDetection に届いた場合の扱いが定義されていない。BR8.7 の logic は「IF status=rejected THEN active=false（索引から外す）」で、`ReportFootprint` の行がすでにある前提で書かれている。しかし `report.saved` と `review.status-changed` は別々の送り手（Reporting と Review）から別々に届く知らせで、Review 側の処理（確認中の記録作成→却下）の方が DuplicateDetection 側の `report.saved` 受信より先に終わることは普通に起こりうる（レビューがすぐ処理されるケース）。`contract-summary.md` 2.5 節は「`review.status-changed` が `report.saved` より先に届いたとき: **ReportCatalog と DuplicateDetection は**、状態だけを先に覚えておき、`report.saved` が届いたら合わせて 1 行（1 つの索引）にする」と明記しており、DuplicateDetection にもこの先行到着への対応を要求している。ReportCatalog 側（U1 の `ReportListItem.savedReceived`／`lastStatusEventAt`）には対応する仕組みがあるが、`ReportFootprint`（entities.md）にはそれに相当する「先に届いた却下状態を覚えておくためのフィールド」が無く、rules.md・functional-spec.md のどこにも「索引がまだ無いときに却下の知らせを受けたらどうするか」の記述が無い。このまま実装すると、却下の知らせが先着した報告は、その後 `report.saved` で索引に `active=true` のまま加わり、却下されたはずの報告が重複判定の比較対象から外れない。 | `ReportFootprint` に「先に届いた却下状態」を覚えるための項目（例: `pendingInactive: boolean` や `savedReceived: boolean`）を追加し、BR8.7 と UC12 に「索引の行がまだ無いときは覚えておき、`report.saved` で索引を作るときに反映する」処理を明記する。contract-summary 2.5 節の要求に実際に応える設計に直す。 | New |
| R-03 | Major | `construction/u2-report-duplicate/functional-design/rules.md` の BR9.1 | BR9.1 の `statement` は「設定を読めるのは、ログインしている利用者と**ほかの部品**」と書いているが、同じ規則の `logic` は `IF ログイン済み THEN 対象地域を返す` としか書いておらず、「ほかの部品」側（部品の身元の証明で呼ぶケース）の分岐が無い。`contract-summary.md` 2.1b 節は、DuplicateDetection の保存後の再判定が `GET /internal/v1/settings` を「部品の身元の証明」で呼ぶことを明示的に許可しているが、BR9.1 の logic だけを読んで実装すると、この正当な呼び出しをログイン証明が無いという理由で 401 にしてしまう恐れがある。 | BR9.1 の `logic` に「IF 呼び出し元がログイン済みの利用者 OR 2.1b の表にある部品の身元の証明 THEN 対象地域を返す」のように、部品の身元の証明での呼び出しを明示的に許す分岐を足す。 | New |
| R-04 | Minor | `construction/u2-report-duplicate/functional-design/traceability.json` の `AC7.2.2` 行 | `AC7.2.2`（「胸の写真なし」のクマの報告で月の輪の照合が行われない）が `status: OK, target: BR2.17` とされているが、BR2.17 は必須項目の検証の規則であり、月の輪照合が行われないことの根拠にはならない。月の輪照合（US7.2）自体が U2 では作られない（Q1 で次の版に回した）ため、この基準が「たまたま満たされる」のは機能が存在しないからであって、BR2.17 のおかげではない。同じストーリーの `AC7.2.1`・`AC7.2.3` は正しく `N/A`（次の版に回す）とされており、`AC7.2.2` だけ扱いが矛盾している。 | `AC7.2.2` のステータスを `N/A` に直し、target を「次の版に回す（Q1。月の輪の照合は US7.2）」のように AC7.2.1 と揃える。 | New |
| R-05 | Minor | `construction/u2-report-duplicate/functional-design/entities.md` の `Photo.expiresAt`／`rules.md` の BR2.13・BR2.14 | 送信処理の最中（BR2.14 の 24 時間チェックを通過した直後から、保存して `expiresAt` を外すまでの間）に、AWS の TTL／ライフサイクルによる自動削除が割り込むと、写真のレコードまたは実体が送信処理の途中で消える、ごく小さな競合の余地が残っている。BR2.14 は「使えるかどうかの事前チェック」であり、保存のトランザクションそのものと TTL 削除の間の排他は扱っていない。 | Code Generation で、写真と reportId の紐付け（`expiresAt` 解除）を条件付き更新（例: 削除されていないことを条件にした書き込み）にする、または保存後にもう一度写真の存在を確認するなど、競合への対処方針を一言添える。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージに指定された検証ツールなし） | 未実行 | スキル定義に validation tools の指定が見当たらなかったため、ファイルの読み合わせによる手動レビューのみを行った。 |

### Summary

最大の問題は、重複の疑いに関する 2 つのデータの流れが設計として破綻している点である。`Report.duplicateSuspected`（Reporting 側）は書き戻す経路が存在しないまま「DuplicateDetection が立てる」とだけ書かれており、`ReportFootprint` は `review.status-changed` が `report.saved` より先に届く場合（`contract-summary.md` が明示的に要求している順序の入れ替わり対応）を扱えていない。どちらも実装者が契約文書と部品の依存関係を素直に辿れば実装できない・誤って実装してしまう箇所であり、Critical として扱った。これに加え、設定の内部読み出し（BR9.1）の文言と論理の食い違い、トレーサビリティの軽微な過大申告がある。
