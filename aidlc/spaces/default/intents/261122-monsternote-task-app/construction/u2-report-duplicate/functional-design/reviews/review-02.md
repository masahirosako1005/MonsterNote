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
| R-01 | Critical | `construction/u2-report-duplicate/functional-design/functional-spec.md` > UC11「重複の疑いの判定」手順 6、`entities.md` の `Report.duplicateSuspected` | `Report.duplicateSuspected`（Reporting が持つ報告そのものの項目）を「DuplicateDetection が立てる」と UC11 の手順 6 に書いてあるが、DuplicateDetection から Reporting へ書き戻す経路が存在しない。`contract-summary.md` の C14（`duplicate.suspected`）は DuplicateDetection → ReportCatalog（U3）だけで、Reporting 向けの知らせも API 呼び出しも定義されていない。`components.md` の Reporting の `depends_on`／DuplicateDetection の `dependents` にも「DuplicateDetection が Reporting のデータを更新する」という向きの依存は無い。つまり `GET /v1/reports/{reportId}`（Reporting が持つ）から返る `duplicateSuspected` は、送信直後の初期値 `false` のまま一生変わらない、作れないデータ項目になっている。実際の重複表示は C5 `GET /v1/duplicates/{reportId}`（DuplicateDetection）と ReportCatalog の `ReportListItem.duplicateSuspected`（C14 で正しく更新される）で成立しており、`Report.duplicateSuspected` は二重管理のうえ片方が永遠に腐る設計になっている。 | `Report.duplicateSuspected` 項目を entities.md から削除するか、「表示には使わない・常に false のままでよい参考値」と明記する。あるいは、DuplicateDetection から Reporting への書き戻しの経路（新しい内部 API か知らせ）を正式に追加し、contract-summary・components.md 側も合わせて直す。UC11 の手順 6 の主語（誰が・どの API/知らせで Report を書き換えるのか）を具体的に書く。 | Resolved (reviewer) |
| R-02 | Critical | `construction/u2-report-duplicate/functional-design/rules.md` の BR8.7、`functional-spec.md` の UC12 | `review.status-changed`（却下）が、同じ報告の `report.saved` より先に DuplicateDetection に届いた場合の扱いが定義されていない。BR8.7 の logic は「IF status=rejected THEN active=false（索引から外す）」で、`ReportFootprint` の行がすでにある前提で書かれている。しかし `report.saved` と `review.status-changed` は別々の送り手（Reporting と Review）から別々に届く知らせで、Review 側の処理（確認中の記録作成→却下）の方が DuplicateDetection 側の `report.saved` 受信より先に終わることは普通に起こりうる（レビューがすぐ処理されるケース）。`contract-summary.md` 2.5 節は「`review.status-changed` が `report.saved` より先に届いたとき: **ReportCatalog と DuplicateDetection は**、状態だけを先に覚えておき、`report.saved` が届いたら合わせて 1 行（1 つの索引）にする」と明記しており、DuplicateDetection にもこの先行到着への対応を要求している。ReportCatalog 側（U1 の `ReportListItem.savedReceived`／`lastStatusEventAt`）には対応する仕組みがあるが、`ReportFootprint`（entities.md）にはそれに相当する「先に届いた却下状態を覚えておくためのフィールド」が無く、rules.md・functional-spec.md のどこにも「索引がまだ無いときに却下の知らせを受けたらどうするか」の記述が無い。このまま実装すると、却下の知らせが先着した報告は、その後 `report.saved` で索引に `active=true` のまま加わり、却下されたはずの報告が重複判定の比較対象から外れない。 | `ReportFootprint` に「先に届いた却下状態」を覚えるための項目（例: `pendingInactive: boolean` や `savedReceived: boolean`）を追加し、BR8.7 と UC12 に「索引の行がまだ無いときは覚えておき、`report.saved` で索引を作るときに反映する」処理を明記する。contract-summary 2.5 節の要求に実際に応える設計に直す。 | Resolved (reviewer) |
| R-03 | Major | `construction/u2-report-duplicate/functional-design/rules.md` の BR9.1 | BR9.1 の `statement` は「設定を読めるのは、ログインしている利用者と**ほかの部品**」と書いているが、同じ規則の `logic` は `IF ログイン済み THEN 対象地域を返す` としか書いておらず、「ほかの部品」側（部品の身元の証明で呼ぶケース）の分岐が無い。`contract-summary.md` 2.1b 節は、DuplicateDetection の保存後の再判定が `GET /internal/v1/settings` を「部品の身元の証明」で呼ぶことを明示的に許可しているが、BR9.1 の logic だけを読んで実装すると、この正当な呼び出しをログイン証明が無いという理由で 401 にしてしまう恐れがある。 | BR9.1 の `logic` に「IF 呼び出し元がログイン済みの利用者 OR 2.1b の表にある部品の身元の証明 THEN 対象地域を返す」のように、部品の身元の証明での呼び出しを明示的に許す分岐を足す。 | Resolved (reviewer) |
| R-04 | Minor | `construction/u2-report-duplicate/functional-design/traceability.json` の `AC7.2.2` 行 | `AC7.2.2`（「胸の写真なし」のクマの報告で月の輪の照合が行われない）が `status: OK, target: BR2.17` とされているが、BR2.17 は必須項目の検証の規則であり、月の輪照合が行われないことの根拠にはならない。月の輪照合（US7.2）自体が U2 では作られない（Q1 で次の版に回した）ため、この基準が「たまたま満たされる」のは機能が存在しないからであって、BR2.17 のおかげではない。同じストーリーの `AC7.2.1`・`AC7.2.3` は正しく `N/A`（次の版に回す）とされており、`AC7.2.2` だけ扱いが矛盾している。 | `AC7.2.2` のステータスを `N/A` に直し、target を「次の版に回す（Q1。月の輪の照合は US7.2）」のように AC7.2.1 と揃える。 | Resolved (reviewer) |
| R-05 | Minor | `construction/u2-report-duplicate/functional-design/entities.md` の `Photo.expiresAt`／`rules.md` の BR2.13・BR2.14 | 送信処理の最中（BR2.14 の 24 時間チェックを通過した直後から、保存して `expiresAt` を外すまでの間）に、AWS の TTL／ライフサイクルによる自動削除が割り込むと、写真のレコードまたは実体が送信処理の途中で消える、ごく小さな競合の余地が残っている。BR2.14 は「使えるかどうかの事前チェック」であり、保存のトランザクションそのものと TTL 削除の間の排他は扱っていない。 | Code Generation で、写真と reportId の紐付け（`expiresAt` 解除）を条件付き更新（例: 削除されていないことを条件にした書き込み）にする、または保存後にもう一度写真の存在を確認するなど、競合への対処方針を一言添える。 | Resolved (reviewer) |
| R-06 | Minor | `construction/u2-report-duplicate/functional-design/functional-spec.md` > UC9 報告の送信、手順 6・7／`rules.md` BR2.14 の logic | BR2.14 の修正後の文言は「確認と保存の間に自動削除が割り込んだ場合は結び付けに失敗し、**報告は保存されない**」と断定しているが、UC9 の手順は「6. 保存する」→「7. 写真に reportId を入れ、expiresAt を外す（BR2.13）」の順で書かれており、手順 6 ですでに `Report` 行が作られたあとに手順 7 の条件付き書き込みが失敗する形に読める。Photo と Report はどちらも Reporting が持つため、1 つのトランザクション（例: DynamoDB の TransactWriteItems）で両方をまとめて書けば「失敗時は報告も保存されない」という記述と矛盾なく実装できるが、文書のどこにも「6 と 7 は 1 つの不可分な書き込みである」とは明記されておらず、手順どおりに逐次実装すると Report だけが保存され写真が結び付かない（またはその逆）状態が起こり得る。 | UC9 の手順 6・7（または rules.md の BR2.13・BR2.14）に一言、「報告の保存と写真への reportId の付与・期限解除は 1 つの原子的な書き込みとして行う」という実装上の前提を明記する。 | New |

> R-01 Reviewer note: `Report.duplicateSuspected` は entities.md から削除され、代わりに制約として「疑いの正本は `DuplicateSuspicion`（C5 で読む）、一覧の印は `ReportListItem.duplicateSuspected`（C14 で更新）」と明記された。`functional-spec.md` の UC11 手順 6 は削除され、代わりに「書き戻さない」旨の段落と D-7（7 章「約束との違い」）が追加されている。`rules.md` BR8.4 の logic にも同じ注記があり、`components.md` の DuplicateDetection → Reporting 方向の依存は存在しないことを確認した（書き戻し経路が架空になっていない）。ER 図にも `ReportListItem` が追加され一貫している。

> R-02 Reviewer note: `ReportFootprint` に `savedReceived`・`lastSavedEventAt`・`lastStatusEventAt` が追加され、`species`・`location`・`capturedAt`・`speciesDay`・`hunterAccountId` が `savedReceived=true` 条件付き必須になった。新設の BR8.11 が「却下の知らせが先に届いたときは状態だけを覚える行を作り、`report.saved` が届いたときに 1 つの索引にまとめる」処理を明記し、`contract-summary.md` 2.5 節の要求（`review.status-changed` が `report.saved` より先に届いたときの扱い）に正しく対応している。BR8.7 の logic も `savedReceived=true AND active=true` の相手だけを比べるよう直され、UC11・UC12 の手順および状態図（`pending` 状態の追加）も整合している。

> R-03 Reviewer note: BR9.1 の `logic` に「OR contract-summary 2.1b の表にある部品の身元の証明（DuplicateDetection の保存後の再判定からの内部の呼び出し）」という分岐が明示的に追加された。`contract-summary.md` 2.1b 節の表の記載（DuplicateDetection → C11 `GET /internal/v1/settings` を部品の身元の証明で許す）と一致しており、正当な呼び出しが 401 にされる懸念は解消している。

> R-04 Reviewer note: `traceability.json` の `AC7.2.2` は `status: N/A` に直され、`target` も `AC7.2.1`・`AC7.2.3` と同じ「次の版に回す（Q1）」の体裁に揃った。

> R-05 Reviewer note: `entities.md`（Photo.expiresAt の注記）、`rules.md` の BR2.13・BR2.14 に「結び付けの書き込みは『その写真がまだある』ことを条件に行う」旨が追加され、`functional-spec.md` の 6 章に「写真の確認を通った直後に自動削除が割り込んだ」コーナーケースの行が追加された。下の新規指摘（R-06）は、この修正自体の妥当性ではなく、修正によって UC9 の手順の記述との整合性に生じた軽微な曖昧さを指摘するものであり、R-05 自体は Fixed と判定する。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージに指定された検証ツールなし） | 未実行 | スキル定義に validation tools の指定が見当たらなかったため、entities.md・rules.md・functional-spec.md・traceability.json・frontend-components.md・functional-design-questions.md と、上流の contract-summary.md（2.1b・2.5・C2・C5・C9・C11・C12・C14）・components.md を読み合わせる手動レビューを行った。 |

### Summary

反復 1 で指摘した 2 件の Critical（`Report.duplicateSuspected` の書き戻し不能、`review.status-changed` 先着時の索引の扱い）は、データモデル・規則・処理手順・状態図のすべてで一貫して修正されており、上流の contract-summary.md の要求（2.1b・2.5）とも整合することを確認した。Major（BR9.1 の内部呼び出し許可の欠落）と 2 件の Minor（トレーサビリティの過大申告、TTL 競合）も修正済み。新たに見つけたのは、TTL 競合の修正が手順の記述レベルで原子性の前提を明記していない軽微な曖昧さのみで、実装を妨げるものではない。Critical・Major ともに 0 件のため READY と判定する。
