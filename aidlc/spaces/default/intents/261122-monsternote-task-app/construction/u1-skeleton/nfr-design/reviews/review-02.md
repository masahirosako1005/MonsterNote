## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T10:06:13Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 1. ログインと証明、2. API の認可 NFR4.2 | 共有の C1 Accounts の契約（contract-summary.md の C1・2.1）は `POST /v1/session`（ログイン。mustChangePassword・consentRequired・hunterNumberRequired を返す）、`DELETE /v1/session`、`POST /v1/session/refresh` を API の道として定めている。設計は「画面が Cognito を直接呼ぶ（API の道を作らない）」とし、契約の道を黙って消している。さらに NFR4.2 は存在しない `/v1/session*` を認可の除外対象に挙げていて矛盾する。契約は出し直し用の値を「最後の利用から 30 日（使うたびに延びる）」とするが、Cognito のリフレッシュトークンの期限は固定で、使っても延びない。初回の手続きの 3 つの印を返す場所も設計にない。契約の変更として記録も合意もされていない | 次のどちらかを選び、記録する。(a) 契約どおり Accounts の関数が `/v1/session`・`/v1/session/refresh`・ログアウトを提供し、中で Cognito を呼ぶ。(b) 直接呼びに変え、contract-summary の C1 と画面側の呼び出しを更新する（初回手続きの印の取得元と、30 日が固定になる点を明記する）。NFR4.2 の除外対象も実際の道に合わせる | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/performance-design.md > NFR2.3 と reliability-design.md > 1. 知らせの届け方 | 確実に届ける設計（eventSent・3 回の再送・送り直し）は `report.saved` だけが対象。承認では「条件付きの書き込み 1 回と EventBridge への送信 1 回」とあるだけで、送信が失敗したときの動きがない。status=approved が保存された後に送信が失敗すると、再度の承認は条件（checking のときだけ）で拒否され、`review.status-changed` を再送する道がない。ReportCatalog の一覧は checking のまま残り、依頼元の画面で承認済みに見えない。`audit.recorded` の送信失敗の扱いも未定義 | 承認の知らせにも、報告と同じ「送ったかの印＋再送の道」を設ける。または承認の送り直しで、すでに approved かつ未送信なら再送して成功を返す規則を加える。`audit.recorded` の失敗時の扱い（失敗にするか、記録して続けるか）も決める | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/reliability-design.md > 3. 二重と同時の操作 NFR10.2 と 1. 知らせの届け方 | NFR10.2 は「処理中の印（作成中）を先に書き、同じキーが処理中なら 409」とする。一方、Q7 の送り直しは「保存済みの報告の印が『まだ』なら再送して 200」。「作成中」と「保存済み・eventSent=false」の区別、「作成中」から保存への遷移の順序（Accounts の確認・写真への reportId 付与との前後）が書かれていない。関数が保存の前後でタイムアウトや異常終了すると、「作成中」のまま残り、同じキーの送り直しがずっと 409 になる。期限切れの規則もない | 報告の状態（作成中・保存済み＋eventSent・送信済み）の遷移表を書く。「作成中」に期限（例: 数十秒）を付け、期限を過ぎたら引き継いで完了させる規則を定める。写真への reportId 付与の失敗時の扱いも決める | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/performance-design.md > NFR2.2 | 合計の目安 6 秒は、C10 の 2 秒 ＋ EventBridge 3 回（各最大 1 秒）＋ 間隔 1.4 秒 ＋ DynamoDB の SDK の再試行を足すと 6.4 秒を超え得る。Lambda 自体のタイムアウトの値が、どの設計にもない | 各関数の Lambda のタイムアウト（送信は画面の 10 秒より短く、例 8 秒）を明記し、最悪の場合の合計を書き直す | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 3. データの保護 NFR5.3 | 署名付きの PUT の URL では、アップロードの大きさの上限を強制できない。画面側の縮小（NFR2.4）を迂回すると大きなファイルを置けて、無料枠の S3 を圧迫し得る | 署名付きの POST（content-length-range）を使うか、大きさの上限を別の手段（S3 のライフサイクルでの未紐付けの写真の削除、報告の保存時の大きさの確認）で決める | Resolved (reviewer) |
| R-06 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > NFR5.3 / CORS | NFR5.3 は署名付きの POST（presigned POST）に変えたが、約束の `POST /v1/photos` の応答は `photoId` と `uploadUrl` だけ（contract-summary.md の /v1/photos）。presigned POST には送信用のフォーム項目（fields）が要るので、約束の形のままでは実装できない。さらに S3 の CORS が PUT と GET だけで POST を許さないため、ブラウザからの直接アップロードが失敗する。 | 約束 C-契約の応答に fields を加える変更を記録するか、PUT のまま別の方法で大きさを守る。どちらでも S3 の CORS に POST を許すよう直し、設計を 1 つに揃える。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 30 日の延長 | refresh token rotation で、画面が出し直しを同時に 2 回（複数タブなど）送ると、古い値が使えなくなり 401 になってログアウトしうる。Cognito の再利用の猶予時間への言及がない。 | 猶予時間の設定、または出し直しを 1 つのタブに限る旨を 1 行で記す。 | New |

> R-01 Reviewer note: security-design.md は `POST /v1/session`・`POST /v1/session/refresh`・`DELETE /v1/session` を約束 C1 どおり API に置き、Accounts の関数が Cognito を呼ぶ形に直した。refresh token rotation で「最後の利用から 30 日」を満たす。JWT オーソライザーの除外も 2 本の道だけで、NFR4.2 と一致する。

> R-02 Reviewer note: reliability-design.md で `review.status-changed` も eventSent 方式にし、承認の送り直しは 200 で冪等にした。`audit.recorded` は失敗時に `EVENT_PUBLISH_FAILED` をログに書き、本来の操作は止めない。受け入れリスクとして明記済み。

> R-03 Reviewer note: 送信のキーの状態表（なし・作成中の期限内／期限切れ・保存済みで知らせが「まだ」・「済み」）と 30 秒の期限を定義した。期限切れは条件付きの書き込みで取り直せる。保存と写真への reportId の書き込みは TransactWriteItems で行う。

> R-04 Reviewer note: 時間の予算を約 5.8 秒に計算し直した（1＋2＋1＋1.8）。API の関数は 8 秒、受け手の関数は 10 秒の時間切れで、画面の 10 秒の内側に収まる。

> R-05 Reviewer note: presigned POST に変え、content-length-range 1〜15 MB を S3 が強制する。ただし下の新しい指摘 2 件が残る。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| sensors（traceability.json） | 依頼元が合格と伝えた | 構造の検査は通っている。 |

### Summary

前回の 5 件はすべて直っており、Major は新しい 1 件（presigned POST と約束の応答・CORS の不一致）だけなので READY とする。ただしこの 1 件は Code Generation の前に約束か設計を揃えてほしい。
