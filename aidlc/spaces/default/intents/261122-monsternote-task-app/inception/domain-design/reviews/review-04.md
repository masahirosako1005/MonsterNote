## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T06:54:57Z
**Iteration:** 1
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
| R-09 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > ReportCatalog entity ReportListItem（hunterName, placeName） | 一覧の行の hunterName と placeName は、どの部品がどの知らせに載せるかが書かれていない。Report に氏名も地名もない。 | 「報告が保存された」知らせに何を載せるか（氏名は Accounts から、地名の元は何か）を Functional Design の引き継ぎに 1 行加える。 | Resolved (reviewer) |
| R-10 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > 共通の決まり（役割の確認）と AdminApp の削除 | 知らせで動く処理や、Reporting が DuplicateDetection をその場で呼ぶとき、呼び出し元の証明をどう渡すかが書かれていない。 | Functional Design か NFR Design で、部品間の呼び出しの証明の扱いを決めると引き継ぎに書く。 | Resolved (reviewer) |
| R-11 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > component Reporting depends_on Accounts と Accounts dependents | Accounts との呼び出しの説明が「同意済みか確かめ、従事者番号を受け取る」のままで、ADR-012 で追加したハンターの表示名の受け取りが書かれていない | 次に components.md を直すときに、両方の interaction の記述へ「表示名」を加える（Functional Design で扱ってもよい） | Resolved (reviewer) |
| R-12 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/components.md > 39行目と81行目の interaction 文 | 表示名の用途の書き方が2か所で違う（39行目は「一覧用」、81行目は「報告が保存された知らせに載せる」）。意味は矛盾しないが、実装者が読み比べると迷うおそれがある。 | 任意。どちらかの文言に揃える。ブロックしない。 | New |

> R-11 Reviewer note: components.md の Reporting の depends_on Accounts（39行目）と Accounts の dependents 側（81行目）の両方に「表示名」の受け渡しが明記された。ADR-012 の記述（14行目）とも一致し、属性 displayName も Account（56行目、602行目）に存在する。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| grep による 表示名 / displayName の参照確認 | 39, 81, 14, 56, 602 行目で整合 | R-11 の修正が反映済みで、ADR-012 とも矛盾しない |

### Summary

R-11 は修正済みで、新たな重大・主要な指摘はない。表記ゆれが Minor で1件あるだけなので READY とする。
