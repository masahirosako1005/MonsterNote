**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T09:01:48Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u2-report-duplicate/infrastructure-design/infrastructure-specification.md > §2 Infrastructure Services、API Gateway HTTP API の行 | `functional-design/functional-spec.md` の UC14（重複の疑いの相手の一覧、依頼元）は、約束 C5 `GET /v1/duplicates/{reportId}` を明示しており、`functional-design/rules.md` の BR8.9 もこの経路に「role=requester のときだけ返す（403 FORBIDDEN）」という具体的な認可ロジックを与えている。ところが `infrastructure-specification.md` §2 の API Gateway の道の一覧には `POST /v1/photos/{id}/complete`・`POST /v1/reports`・`POST /internal/v1/duplicate-checks`（内部呼び出しのため実際には道として現れないと明記）・`GET /v1/report-settings` の 4 つしかなく、`GET /v1/duplicates/{reportId}` がどこにも現れない。依頼元が重複の疑いの相手を見るための API Gateway の道と、それを受ける Lambda（DuplicateSuspicions の表を持つ `duplicate-detection` が自然な候補）の IAM 権限・JWT オーソライザーの適用が、Infrastructure Design のどこにも落とし込まれていない。 | `GET /v1/duplicates/{reportId}` を §2 の道の一覧に追加し、担当する Lambda（`duplicate-detection` を想定）への統合、JWT オーソライザーの適用、BR8.9 の role=requester の確認をどこで行うか（Lambda 内のロジックか、別の仕組みか）を明記する。あわせて traceability.json・cicd-pipeline.md のスモーク手順にもこの経路の確認を足す。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u2-report-duplicate/infrastructure-design/infrastructure-specification.md > §2 Lambda `reporting`（既存。更新）の行 | `nfr-design/security-design.md` §2 の表と `functional-design/rules.md` BR9.1 は、Reporting から Settings 関数への呼び出しの証明の種類を「利用者の証明（ハンターの JWT）」と明記しており、「部品の身元の証明（ADR-011）」が許されるのは DuplicateDetection の保存後の再判定（利用者がいない処理）だけだと述べている（security-design.md も「DuplicateDetection の IAM ロールには、Settings の関数を呼ぶ権限だけを付ける」と、ADR-011 の対象を DuplicateDetection に限定）。ところが `infrastructure-specification.md` §2 は、Reporting の行にも「Settings 関数への直接呼び出し権限（ADR-011）」と書いており、Reporting→Settings の呼び出しを DuplicateDetection と同じ部品の身元の証明（ADR-011）の枠組みとして扱っている。`traceability.json` の NFR4.8 の coverage 行も同様に「settings関数、ADR-011の部品の身元の証明」とだけ書き、Reporting 側が利用者の証明を転送する別の経路であることを区別していない。実装時にこの混同のまま進むと、BR9.1 の「IF 呼び出し元がログイン済みの利用者」という認可条件を Settings 関数側で検証できなくなるおそれがある（ADR-011 の IAM ロールだけで許可すると、呼び出し元の個々の利用者を検証しない）。 | `infrastructure-specification.md` §2 の Reporting の行を、「Settings 関数への呼び出し（利用者の JWT を転送。Lambda の直接呼び出しに IAM の許可は要るが、認可の判断は BR9.1 のとおり転送された JWT で行う）」のように、ADR-011（部品の身元の証明）とは別の経路として書き分ける。traceability.json の NFR4.8 の記述もあわせて修正する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u2-report-duplicate/infrastructure-design/monitoring-design.md > Metrics & KPIs | U1 の `monitoring-design.md` には「関数の時間切れの近さ」という KPI があり、しきい値は「8 秒（API）・10 秒（受け手）の 80%」となっている。U2 の `performance-design.md` で Reporting（API の関数）の時間切れが 8 秒から 9 秒に変わったが、U2 の `monitoring-design.md` はこの KPI のしきい値更新に触れていない。アラームではなく参考値のため実害は小さいが、運用時に古い 8 秒基準のまま確認すると誤解を招く。 | U2 の `monitoring-design.md` に、「関数の時間切れの近さ」の API 側のしきい値が Reporting 関数について 9 秒の 80%（約 7.2 秒）に変わる旨を一言追記する。 | Resolved (reviewer) |

> R-01 Reviewer note: `infrastructure-specification.md` §2 の API Gateway の道の一覧に `GET /v1/duplicates/{reportId}`（約束C5、BR8.9、role=requesterのJWTオーソライザーの確認、担当は`duplicate-detection`関数）が追加された。`functional-spec.md` UC14／C5、`rules.md` BR8.9 と整合している。

> R-02 Reviewer note: `infrastructure-specification.md` §2のReporting行が「Settings関数への呼び出しは利用者の証明〈ハンターのJWT〉をそのまま転送する呼び出しで、ADR-011の部品の身元の証明ではない」と書き直され、DuplicateDetection行は引き続きADR-011として区別されている。settings関数の行にも「呼び出し元ごとに証明の種類を確認する」という検証ロジックが明記された。`security-design.md` §2の表（Reporting＝利用者の証明／DuplicateDetection＝ADR-011）と一致する。`traceability.json`のNFR4.8の説明も同様に修正済み。

> R-03 Reviewer note: `monitoring-design.md` のMetrics & KPIsに「関数の時間切れの近さ（更新）」行が追加され、`reporting`関数は9秒の80%を基準にする旨が明記された。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (本ステージに紐づく自動検証ツールの指定なし) | 実行せず | 手動でのクロスリファレンス確認（infrastructure-specification.md §2・traceability.json・monitoring-design.mdと、functional-spec.md UC14・rules.md BR8.9／BR9.1・security-design.md §2との突き合わせ）で検証した |

### Summary

iteration 1で指摘したCritical 1件（約束C5のAPI Gateway道の欠落）・Major 1件（Reporting→Settingsの証明の種類の取り違え）・Minor 1件（時間切れKPIの未更新）は、いずれも該当箇所の修正とアップストリーム成果物（functional-spec.md、rules.md、security-design.md）との突き合わせで解消を確認した。新たなCritical／Major指摘はなく、READYとする。
