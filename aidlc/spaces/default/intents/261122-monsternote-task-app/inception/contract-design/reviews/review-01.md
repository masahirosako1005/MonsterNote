## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T09:11:35Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 2.1 ログインの証明 と 4. C8〜C11 | 部品の間の呼び出し（C8〜C11）は「画面から受け取った証明をそのまま付ける」としか決めていない。しかし画面の証明がない呼び出し元が 2 つある。(a) Reporting が 24 時間で結び付かない写真を消すとき（定期の処理）に C8 `DELETE /internal/v1/species-detections/by-photos` を呼ぶ。(b) DuplicateDetection が `report.saved` を受けて保存後に再判定するとき（知らせで動く処理）に C11 で設定を読む。どちらも利用者の証明がないため、証明の確認（ADR-007）を通る手段がない | 利用者の証明がない内部呼び出しの認証の形（例: 部品自身の身元を示す別の証明、または証明なしで許す呼び出しの一覧）を C16 に追加し、C8 の削除と C11 の読み出しがどちらで動くかを明記する。具体の仕組みは NFR Design に回してよいが、契約として「証明なしの呼び出し」を認める範囲を決めること | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 1. 約束の一覧 C8 と 4. `/internal/v1/species-detections/by-photos` | C8 の利用者に AdminApp（U4）を挙げ、「Reporting・AdminApp → SpeciesDetection」と書いている。一方で `/internal/...` は「外からは呼べない内部の道」と定めている。AdminApp は外に公開する画面アプリなので、全削除（US6.5）のときに SpeciesDetection の判別結果を消す道が実在しない。C1〜C7 の画面向け API にも SpeciesDetection の削除はない（components.md の AdminApp は SpeciesDetection を直接呼ぶ依存を持つ） | SpeciesDetection に画面向けの管理者用削除 API（`/v1/admin/detection-data` など）を C 番号付きで追加するか、AdminApp が呼ぶ削除を Reporting 経由に変えて components.md と整合させる。C8 の利用者欄から AdminApp を外すか、道を公開側に移す | New |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 3. C1 Accounts（`/v1/session`） | components.md の Accounts は「最後の利用から 30 日はログインの状態を保って、証明（有効期限 1 時間）を出し直す」と定める（FR1.6・FR1.7）。C1 には証明の出し直し（更新）の道もその方式の記載もなく、`POST /v1/session` と `DELETE /v1/session` だけがある。証明は 1 時間で切れるため、画面が 30 日の保持をどう実現するかを開発者が推測するしかない。無効化したアカウントに出し直さない（FR10.4）規則も、どの道で効くか決まっていない | C1 に証明の出し直しの道（例: `POST /v1/session/refresh`、更新用の値の持たせ方と有効期限 30 日、無効アカウントは 401）を追加する。または認証サービスが直接担う方式なら、その旨と C1 との分担を契約に書く | New |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 2.2 エラーの形 と C2 `POST /v1/reports` 409、C3 decision 409 | 409 の応答は「相手の種類・日時・おおよその距離」「確認した人と結果」を返すと書くが、共通の `Error` には `code`・`message`・`details[field, reason]` しかなく、これらを載せる場所がない。`DUPLICATE_SUSPECTED` も 2.2 の code の例にない | `Error` に任意の拡張項目（例: `context` オブジェクト）を足し、該当の 409 でその中身の形を示す。code の表に `DUPLICATE_SUSPECTED` を加える | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 5. 知らせ と 7. 未解決の点 | 知らせの順番が入れ替わったときの受け手の決まりが契約にない。`review.status-changed` が `report.saved` より先に ReportCatalog に着く場合の行の作り方、却下と却下の取り消しが逆順に着いたときの DuplicateDetection の索引（`active`）の最終状態が決まらない。`eventId` は重複排除だけで、順序を判断する項目は `changedAt` しかない | 受け手の共通の決まり（行がなければ作る upsert、同じ報告への状態の知らせは `changedAt` の新しいものを採る、など）を 2.4 に追記する。配送の仕組みは NFR Design のままでよい | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 5. `duplicate.suspected` の `phase` | `phase` に `presubmit` があるが、送信前の問い合わせ（C9）の時点では報告がまだ保存されておらず `reportId` が存在しない。components.md でも知らせを送るのは「疑いを付けたとき」（保存後）である。また `report.saved` が付けた本人側と相手側の双方に印を付ける場合の送り方（1 件か 2 件か）が不明 | `presubmit` の値を外すか、報告がない場合の `reportId` の扱いを決める。双方への印は知らせ 1 件に両方を含めるのか 2 件送るのかを明記する | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 2.3 時間切れとやり直し | 報告の送信では内部呼び出しが C10・C9・C11 の順に最大 3 秒ずつ（最悪 9 秒）かかりうる一方、画面側の時間切れは 10 秒。画面が時間切れでやり直したとき、最初の送信がまだ処理中だと同じ `submissionKey` が並行して届く。「何度送っても 1 件」が並行の場合にも成り立つ決まり（条件付きの書き込み）は書かれていない | 並行の同じ `submissionKey` は 1 件だけ保存し、他方は保存済みの結果を返す（または 409 で待たせる）と一文で契約に書く。内部呼び出しの合計の上限を 10 秒の内に収める配分（例: C11 は設定を読むのでキャッシュしてよい）を示す | New |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-summary.md > 2.1 と C1 `/v1/session` | 2.1 は「すべての API に Bearer を付ける」とするが、ログイン（`POST /v1/session`）は証明を持たない呼び出しである。管理者用の削除 API（`/v1/admin/*-data`）にも 401・403 の応答が書かれていない | ログインだけは証明なしで呼べると例外を明記する。管理者用 API の応答に 401・403 を共通の応答として足す | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| なし（この段階に検証ツールの指定なし） | 該当なし | components.md・unit-of-work.md・contract-summary.md の部品名・C 番号・US 番号を目で照合した。C12〜C15 の送り手・受け手は components.md の依存と一致し、循環する同期呼び出しはない（同期呼び出しは Reporting → Accounts・Settings・SpeciesDetection・DuplicateDetection と DuplicateDetection → Settings のみで、知らせの向きも一方向） |

### Summary

Q1〜Q6 の決定（REST と /v1、アップロード用 URL、共通の知らせの外側と冪等な受け手、持ち主の決まり、エラーと時間切れ）は一覧・仕様・決まりに一貫して反映され、C12〜C15 の知らせの中身も components.md と合っている。ただし、利用者の証明がない内部呼び出しの認証、AdminApp から SpeciesDetection の削除に至る道の矛盾、ログイン状態の 30 日保持（証明の出し直し）の道の欠落、の 3 件の Major により、開発者が推測なしに作れる状態ではない。これらを補えば READY に近づく。
