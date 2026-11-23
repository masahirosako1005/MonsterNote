## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T06:51:15Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components Reporting / SpeciesDetection、entity Photo・DetectionResult・Report | 写真の判別は「種類の確認」の画面（送信の前）で結果を出す必要があるが（FR3.1）、下書きは残さない（FR2.9）ため、送信の前の写真を誰がどの時点で保存し判別を呼ぶかが書かれていない。Photo は reportId を持つのに、報告が作られる前に写真と DetectionResult（photoId を指す）が先に存在することになる。Reporting の behaviour は「送信のときは判別の結果を報告に結び付け」とだけあり、画面からの呼び出しの順（写真の受け取り → 判別 → 送信）と、送信されずに捨てられた写真・判別結果の扱いも決まっていない。 | 送信の前の写真の受け取りと判別の呼び出しを、どの部品が受け持つか（Reporting が写真を先に受け取り SpeciesDetection を呼ぶ、など）を behaviour に明記する。Photo の reportId を送信の前は空にできるのか、送信されなかった写真と判別結果をどう扱うかも書く（詳細は Functional Design でもよいが、持ち主と順序はここで決める）。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components Review・DuplicateDetection、「報告が却下された」知らせ | 却下は 10 秒以内なら取り消して確認中に戻せる（FR8.5）。しかし DuplicateDetection に送る知らせは「却下された」だけで、索引（ReportFootprint.active）を外した後に取り消されたとき、再び比べる相手に戻す知らせが定義されていない。取り消された報告が、以後ずっと重複の判定から漏れる（不正検出という一番の課題への穴）。10 秒間は却下が確定扱いのため、知らせを送る時点（確定のとき／猶予が終わったとき）も決まっていない。 | 取り消しを表す知らせ（例: 却下の取り消し）を Review の送る知らせに加え、DuplicateDetection がそれを受けて ReportFootprint を有効に戻すことを behaviour と depends_on に書く。または、却下の知らせを猶予が終わってから送ると決める。どちらかを選んで記録する。 | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components Review・Settings・AuditLog・DuplicateDetection の depends_on、Accounts の responsibilities | 役割による制限（NFR4: 承認・却下は依頼元だけ、設定は管理者だけ、記録の閲覧は管理者だけ）が各部品の behaviour に書かれているが、呼び出し元の役割を誰がどう判定するかの流れがない。Accounts に「役割と所属による利用の範囲の判定」があるのに、Accounts に依存しているのは Reporting と 3 つの画面アプリだけで、Review・Settings・AuditLog・DuplicateDetection は Accounts に依存しない。画面で隠すだけでなく API でも確認する要件を、実装する人が推測せずに作れない。 | 役割の確認の方法（各部品が Accounts に問い合わせる、またはログインの状態に含めた役割を各部品が読む、など）を 1 つ決め、必要な depends_on と dependents を足す。認証の共通の入口を部品として切り出すかも、ここで決める。 | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components RequesterApp・HunterApp、entities Report・ReviewDecision・DuplicateSuspicion | 依頼元の一覧は、内容（Report）・状態（ReviewDecision）・重複の疑い（DuplicateSuspicion）・手入力の印（Report）の 3 つの部品のデータで絞り込み、新しい順に 1 ページ 50 件に分ける（FR8.1・FR8.2）。ハンターの一覧も内容と状態を合わせる。ADR-001 は「画面が 2 つの部品を呼ぶ」としか触れておらず、3 部品をまたぐ絞り込みとページ分けを誰が受け持つか（画面が全件を集めて絞るのか、どこかが合成するのか）が決まっていない。絞り込み条件がページ分けと同時に効くため、画面側の結合では 50 件の一覧を作れない。 | 一覧を作る合成の持ち主を決める（読み出し専用の一覧の部品を足す、Review が状態に加え必要な項目の写しを持つ、など）。ADR-001 の悪い点に、この結合の扱いと選んだ方法を書き足す。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components AdminApp・SpeciesDetection、ADR-006 | 試験運用の終わりの削除（FR10.2）で、ADR-006 は SpeciesDetection も自分のデータ（DetectionResult）を持つと書くが、SpeciesDetection の responsibilities に削除がなく、AdminApp の depends_on にも SpeciesDetection がない。ADR-006 は「Reporting の写真の削除と合わせて消す方法を Functional Design で決める」と先送りしている。 | SpeciesDetection に削除の責務を足して AdminApp から呼ぶか、Reporting の削除が DetectionResult の削除まで受け持つのかを決め、components.md と ADR-006 を揃える。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component HunterApp、component Settings の dependents | HunterApp は「日時・場所の確認は画面でも行う」とあるが、対象地域（Settings）を読む道がない（HunterApp は Settings に依存せず、Settings の dependents は Reporting・DuplicateDetection・AdminApp のみ）。 | 画面が対象地域を Reporting 経由で得るのか、Settings を直接読むのかを書き、依存の宣言を揃える。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component Reporting depends_on DuplicateDetection、「報告が保存された」知らせ | Reporting → DuplicateDetection は sync と 1 行だけ宣言され、interaction の中に「保存したら知らせる（非同期）」が混ざっている。知らせの受け手が Review と DuplicateDetection の 2 つなのに、depends_on は DuplicateDetection への event を別の行として持たない。また、報告の保存と知らせの送信を同時に成り立たせる方法（知らせの欠落時に Review の記録がなく報告が確認できなくなる）は NFR Design に先送りされているが、「知らせが失われたら報告は永遠に確認中にならない」影響は ADR-001・ADR-003 の悪い点に明記されていない。 | Reporting の depends_on を sync（問い合わせ）と event（保存の知らせ）の 2 行に分ける。知らせの欠落の影響を ADR-001・ADR-003 の悪い点に書き、NFR Design で必ず決めるものとして引き継ぎ事項に残す。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component UiKit external_dependencies、ADR-005 | 部品の説明の冒頭は「技術の選び方は NFR と Infrastructure で決める」とあるが、UiKit の外部の依存に MUI（team-practices で決まっていれば出典を付ける）、ADR-005 に `frontend` の中に置くというコードの置き場所が書かれている。配置は Units Generation の範囲。 | MUI は team-practices の出典を付けて「確定済みの前提」と明記するか外す。コードの置き場所の文は Units Generation に回す。 | Resolved (reviewer) |
| R-09 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > ReportCatalog entity ReportListItem（hunterName, placeName） | 一覧の行の hunterName と placeName は、どの部品がどの知らせに載せるかが書かれていない。Report に氏名も地名もない。 | 「報告が保存された」知らせに何を載せるか（氏名は Accounts から、地名の元は何か）を Functional Design の引き継ぎに 1 行加える。 | New |
| R-10 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > 共通の決まり（役割の確認）と AdminApp の削除 | 知らせで動く処理や、Reporting が DuplicateDetection をその場で呼ぶとき、呼び出し元の証明をどう渡すかが書かれていない。 | Functional Design か NFR Design で、部品間の呼び出しの証明の扱いを決めると引き継ぎに書く。 | New |

> R-01 Reviewer note: ADR-009 と Reporting の behaviour に、写真の受け付け→判別→報告送信で reportId を入れる、の順序と持ち主が明記された。結び付かない写真は 24 時間で写真と判別の結果を消す。Photo に uploadedByAccountId があり、持ち主の確認も述べられている。

> R-02 Reviewer note: Review が「却下が取り消された」知らせを送り、DuplicateDetection が索引に戻す（ReportFootprint.active）。components.md の両側の depends_on・dependents、図、ADR-003 が一致している。猶予後に送る案を退けた理由も書かれている。

> R-03 Reviewer note: ADR-007 と「共通の決まり」で、ログインの証明に役割を入れ各部品の入口で確かめる方式に一本化された。Accounts への追加の依存は不要で、依存図とも矛盾しない。

> R-04 Reviewer note: ReportCatalog（ADR-010）が一覧を所有する。依存・イベントの向きに輪はなく、Reporting・Review・DuplicateDetection・HunterApp・RequesterApp・AdminApp の記述も両側で一致している。

> R-05 Reviewer note: SpeciesDetection の dependents に AdminApp が入り、ADR-006 の 5 部品と一致した。

> R-06 Reviewer note: HunterApp は Reporting 経由で対象地域を読む。ADR-010 と depends_on が一致している。

> R-07 Reviewer note: Reporting→DuplicateDetection の sync と event が別の行に分かれた。ADR-008 に失われた知らせの影響の表があり、届け方は NFR Design に引き継がれた。

> R-08 Reviewer note: MUI は Refined Mockups の Q1（mockups.md・refined-mockups-questions.md で確認済み）を出典として示した。コードの置き場所は Units Generation に移した。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json（センサー） | 実行せず（briefing で pass と報告済み） | 参照の整合は目視で確認した。部品間の依存に輪はなく、参照先はすべて存在する。 |

### Summary

R-01〜R-08 はすべて解消された。新しい指摘は、一覧の項目の出どころと、部品間の呼び出しでの証明の扱いの 2 件で、どちらも Minor であり次のステージで決められる。READY（助言のみ）。
