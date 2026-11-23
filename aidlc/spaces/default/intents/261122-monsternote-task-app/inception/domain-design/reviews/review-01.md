## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T06:45:38Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components Reporting / SpeciesDetection、entity Photo・DetectionResult・Report | 写真の判別は「種類の確認」の画面（送信の前）で結果を出す必要があるが（FR3.1）、下書きは残さない（FR2.9）ため、送信の前の写真を誰がどの時点で保存し判別を呼ぶかが書かれていない。Photo は reportId を持つのに、報告が作られる前に写真と DetectionResult（photoId を指す）が先に存在することになる。Reporting の behaviour は「送信のときは判別の結果を報告に結び付け」とだけあり、画面からの呼び出しの順（写真の受け取り → 判別 → 送信）と、送信されずに捨てられた写真・判別結果の扱いも決まっていない。 | 送信の前の写真の受け取りと判別の呼び出しを、どの部品が受け持つか（Reporting が写真を先に受け取り SpeciesDetection を呼ぶ、など）を behaviour に明記する。Photo の reportId を送信の前は空にできるのか、送信されなかった写真と判別結果をどう扱うかも書く（詳細は Functional Design でもよいが、持ち主と順序はここで決める）。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components Review・DuplicateDetection、「報告が却下された」知らせ | 却下は 10 秒以内なら取り消して確認中に戻せる（FR8.5）。しかし DuplicateDetection に送る知らせは「却下された」だけで、索引（ReportFootprint.active）を外した後に取り消されたとき、再び比べる相手に戻す知らせが定義されていない。取り消された報告が、以後ずっと重複の判定から漏れる（不正検出という一番の課題への穴）。10 秒間は却下が確定扱いのため、知らせを送る時点（確定のとき／猶予が終わったとき）も決まっていない。 | 取り消しを表す知らせ（例: 却下の取り消し）を Review の送る知らせに加え、DuplicateDetection がそれを受けて ReportFootprint を有効に戻すことを behaviour と depends_on に書く。または、却下の知らせを猶予が終わってから送ると決める。どちらかを選んで記録する。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components Review・Settings・AuditLog・DuplicateDetection の depends_on、Accounts の responsibilities | 役割による制限（NFR4: 承認・却下は依頼元だけ、設定は管理者だけ、記録の閲覧は管理者だけ）が各部品の behaviour に書かれているが、呼び出し元の役割を誰がどう判定するかの流れがない。Accounts に「役割と所属による利用の範囲の判定」があるのに、Accounts に依存しているのは Reporting と 3 つの画面アプリだけで、Review・Settings・AuditLog・DuplicateDetection は Accounts に依存しない。画面で隠すだけでなく API でも確認する要件を、実装する人が推測せずに作れない。 | 役割の確認の方法（各部品が Accounts に問い合わせる、またはログインの状態に含めた役割を各部品が読む、など）を 1 つ決め、必要な depends_on と dependents を足す。認証の共通の入口を部品として切り出すかも、ここで決める。 | New |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components RequesterApp・HunterApp、entities Report・ReviewDecision・DuplicateSuspicion | 依頼元の一覧は、内容（Report）・状態（ReviewDecision）・重複の疑い（DuplicateSuspicion）・手入力の印（Report）の 3 つの部品のデータで絞り込み、新しい順に 1 ページ 50 件に分ける（FR8.1・FR8.2）。ハンターの一覧も内容と状態を合わせる。ADR-001 は「画面が 2 つの部品を呼ぶ」としか触れておらず、3 部品をまたぐ絞り込みとページ分けを誰が受け持つか（画面が全件を集めて絞るのか、どこかが合成するのか）が決まっていない。絞り込み条件がページ分けと同時に効くため、画面側の結合では 50 件の一覧を作れない。 | 一覧を作る合成の持ち主を決める（読み出し専用の一覧の部品を足す、Review が状態に加え必要な項目の写しを持つ、など）。ADR-001 の悪い点に、この結合の扱いと選んだ方法を書き足す。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > components AdminApp・SpeciesDetection、ADR-006 | 試験運用の終わりの削除（FR10.2）で、ADR-006 は SpeciesDetection も自分のデータ（DetectionResult）を持つと書くが、SpeciesDetection の responsibilities に削除がなく、AdminApp の depends_on にも SpeciesDetection がない。ADR-006 は「Reporting の写真の削除と合わせて消す方法を Functional Design で決める」と先送りしている。 | SpeciesDetection に削除の責務を足して AdminApp から呼ぶか、Reporting の削除が DetectionResult の削除まで受け持つのかを決め、components.md と ADR-006 を揃える。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component HunterApp、component Settings の dependents | HunterApp は「日時・場所の確認は画面でも行う」とあるが、対象地域（Settings）を読む道がない（HunterApp は Settings に依存せず、Settings の dependents は Reporting・DuplicateDetection・AdminApp のみ）。 | 画面が対象地域を Reporting 経由で得るのか、Settings を直接読むのかを書き、依存の宣言を揃える。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component Reporting depends_on DuplicateDetection、「報告が保存された」知らせ | Reporting → DuplicateDetection は sync と 1 行だけ宣言され、interaction の中に「保存したら知らせる（非同期）」が混ざっている。知らせの受け手が Review と DuplicateDetection の 2 つなのに、depends_on は DuplicateDetection への event を別の行として持たない。また、報告の保存と知らせの送信を同時に成り立たせる方法（知らせの欠落時に Review の記録がなく報告が確認できなくなる）は NFR Design に先送りされているが、「知らせが失われたら報告は永遠に確認中にならない」影響は ADR-001・ADR-003 の悪い点に明記されていない。 | Reporting の depends_on を sync（問い合わせ）と event（保存の知らせ）の 2 行に分ける。知らせの欠落の影響を ADR-001・ADR-003 の悪い点に書き、NFR Design で必ず決めるものとして引き継ぎ事項に残す。 | New |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component UiKit external_dependencies、ADR-005 | 部品の説明の冒頭は「技術の選び方は NFR と Infrastructure で決める」とあるが、UiKit の外部の依存に MUI（team-practices で決まっていれば出典を付ける）、ADR-005 に `frontend` の中に置くというコードの置き場所が書かれている。配置は Units Generation の範囲。 | MUI は team-practices の出典を付けて「確定済みの前提」と明記するか外す。コードの置き場所の文は Units Generation に回す。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json（決定論的 sensor、依頼文で通過済みと報告） | PASS（隙間なし） | 要件との対応の欠けはない。ただし対応の有無だけで、上記の部品間の流れの穴は検出されない |
| 部品の依存の輪（components.md の depends_on を人手で追跡） | 呼び出しの輪なし | Reporting→DuplicateDetection、Review→DuplicateDetection、Reporting→Review（event）はすべて一方向。Review の entity が Report を参照し Reporting が Review に知らせるのはデータの参照と知らせであり、呼び出しの輪ではない |
| 部品名・entity の参照の解決 | 解決する | 参照先の entity はすべて所有する部品に存在する（Report→Account・DetectionResult、DetectionResult→Photo など）。ただし DetectionResult→Photo→Report と Report→DetectionResult の間のデータの順序が未定（上記の 1 件目） |

### Summary

部品の分け方（内容と状態の分離、判別・重複の独立、イベントによる監査、自分の索引を持つ重複の判定）と ADR の 4 項目（Context・Decision・Consequences・Alternatives Rejected）は筋が通り、呼び出しの輪もない。一方で、送信前の写真と判別の順序、却下の取り消しと索引の同期、役割の確認の経路、3 部品をまたぐ一覧の合成の 4 つは、実装する人が推測しないと作れない Major の穴なので、Request Changes で補うことを勧める（助言の位置づけの review のため、人の判断を妨げない）。
