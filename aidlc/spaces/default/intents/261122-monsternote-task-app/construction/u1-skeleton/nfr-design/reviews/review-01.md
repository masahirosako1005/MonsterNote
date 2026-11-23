## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T10:04:10Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 1. ログインと証明、2. API の認可 NFR4.2 | 共有の C1 Accounts の契約（contract-summary.md の C1・2.1）は `POST /v1/session`（ログイン。mustChangePassword・consentRequired・hunterNumberRequired を返す）、`DELETE /v1/session`、`POST /v1/session/refresh` を API の道として定めている。設計は「画面が Cognito を直接呼ぶ（API の道を作らない）」とし、契約の道を黙って消している。さらに NFR4.2 は存在しない `/v1/session*` を認可の除外対象に挙げていて矛盾する。契約は出し直し用の値を「最後の利用から 30 日（使うたびに延びる）」とするが、Cognito のリフレッシュトークンの期限は固定で、使っても延びない。初回の手続きの 3 つの印を返す場所も設計にない。契約の変更として記録も合意もされていない | 次のどちらかを選び、記録する。(a) 契約どおり Accounts の関数が `/v1/session`・`/v1/session/refresh`・ログアウトを提供し、中で Cognito を呼ぶ。(b) 直接呼びに変え、contract-summary の C1 と画面側の呼び出しを更新する（初回手続きの印の取得元と、30 日が固定になる点を明記する）。NFR4.2 の除外対象も実際の道に合わせる | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/performance-design.md > NFR2.3 と reliability-design.md > 1. 知らせの届け方 | 確実に届ける設計（eventSent・3 回の再送・送り直し）は `report.saved` だけが対象。承認では「条件付きの書き込み 1 回と EventBridge への送信 1 回」とあるだけで、送信が失敗したときの動きがない。status=approved が保存された後に送信が失敗すると、再度の承認は条件（checking のときだけ）で拒否され、`review.status-changed` を再送する道がない。ReportCatalog の一覧は checking のまま残り、依頼元の画面で承認済みに見えない。`audit.recorded` の送信失敗の扱いも未定義 | 承認の知らせにも、報告と同じ「送ったかの印＋再送の道」を設ける。または承認の送り直しで、すでに approved かつ未送信なら再送して成功を返す規則を加える。`audit.recorded` の失敗時の扱い（失敗にするか、記録して続けるか）も決める | New |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/reliability-design.md > 3. 二重と同時の操作 NFR10.2 と 1. 知らせの届け方 | NFR10.2 は「処理中の印（作成中）を先に書き、同じキーが処理中なら 409」とする。一方、Q7 の送り直しは「保存済みの報告の印が『まだ』なら再送して 200」。「作成中」と「保存済み・eventSent=false」の区別、「作成中」から保存への遷移の順序（Accounts の確認・写真への reportId 付与との前後）が書かれていない。関数が保存の前後でタイムアウトや異常終了すると、「作成中」のまま残り、同じキーの送り直しがずっと 409 になる。期限切れの規則もない | 報告の状態（作成中・保存済み＋eventSent・送信済み）の遷移表を書く。「作成中」に期限（例: 数十秒）を付け、期限を過ぎたら引き継いで完了させる規則を定める。写真への reportId 付与の失敗時の扱いも決める | New |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/performance-design.md > NFR2.2 | 合計の目安 6 秒は、C10 の 2 秒 ＋ EventBridge 3 回（各最大 1 秒）＋ 間隔 1.4 秒 ＋ DynamoDB の SDK の再試行を足すと 6.4 秒を超え得る。Lambda 自体のタイムアウトの値が、どの設計にもない | 各関数の Lambda のタイムアウト（送信は画面の 10 秒より短く、例 8 秒）を明記し、最悪の場合の合計を書き直す | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 3. データの保護 NFR5.3 | 署名付きの PUT の URL では、アップロードの大きさの上限を強制できない。画面側の縮小（NFR2.4）を迂回すると大きなファイルを置けて、無料枠の S3 を圧迫し得る | 署名付きの POST（content-length-range）を使うか、大きさの上限を別の手段（S3 のライフサイクルでの未紐付けの写真の削除、報告の保存時の大きさの確認）で決める | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| nfr-design/traceability.json（sensor） | 全 NFR が OK と記録 | NFR4.2 の行は「全道に JWT」とあり、契約の `/v1/session*` との食い違いは検出されていない（上の 1 件目） |

### Summary

Q1〜Q7 の人の決定とその残るリスクは尊重した。ただし、ログインの道が共有の契約から無断で外れていること、承認の知らせに確実に届ける設計がないこと、「作成中」の状態が止まったままになり得ることの 3 つの Major があり、NOT-READY とする。
