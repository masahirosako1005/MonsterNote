**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T09:55:15Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/infrastructure-design/infrastructure-specification.md > §2 Infrastructure Services（`catalog` 関数の行）／ Assumptions | `infrastructure-specification.md` は「すべて削除」の順番①（一覧／ReportCatalog）を `catalog` 関数という、`review` 関数とは別の既存関数に割り当てている（実際の U1／U3 の関数境界どおりで、これ自体は正しい）。しかし、この Unit の `nfr-design/logical-components.md` §1 は依然として「Review 関数（ReportCatalog を含む）」と書いており、削除入口が付く既存部品として `catalog` という行を独立に立てていない。`infrastructure-specification.md` の Assumptions は 15 秒への時間切れ統一について `catalog` を足す理由だけを述べており、「nfr-design の前提（ReportCatalog は Review に含まれる）とは異なる、U1／U3 の実際の関数境界に沿って読み替えた」という訂正そのものには一切触れていない。U3 の Infrastructure Design は同種のズレ（review と catalog の境界の取り違え）を発見したとき、専用の「U1 の構成の訂正」という注記で明記していた。同じ注記が本書には無く、Code Generation が nfr-design と infrastructure-specification のどちらの関数モデル（Review に統合／catalog は別関数）を正としてよいか判断に迷う余地が残る | §2 の `catalog` 関数の行（または Assumptions）に、U3 のときと同じ形で「nfr-design/logical-components.md は ReportCatalog を Review に含めて書いているが、実際の U1／U3 の構成では catalog は別関数であり、ここではその実際の境界に沿って削除の入口①を catalog 関数に置く」という訂正の一文を明記する | Resolved (reviewer) |
| R-02 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/infrastructure-design/traceability.json | `nfr-design/traceability.json` では NFR6.3（秘密情報、U1 の設計を変更なしで適用）が `status: OK` として記載されているが、`infrastructure-design/traceability.json` の `upstream_ids`／`coverage` には NFR6.3 が一件も現れない。同種の「U4 では変更しない」上流 ID（NFR2.1・NFR2.10・NFR4.3・NFR3.8 など）はいずれも `N/A` として明記して引き継いでいるのに、NFR6.3 だけが抜け落ちている | NFR6.3 を `upstream_ids` に追加し、他の「変更なし」項目と同じ扱いで `coverage` に `N/A`（または該当する理由）を記載する | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/infrastructure-design/infrastructure-specification.md > §2 Lambda `accounts`（既存。更新） | `accounts` 関数の IAM 権限に Cognito の `AdminCreateUser`・`AdminSetUserPassword` に加えて `AdminUpdateUserAttributes` が追加されているが、BR11.2（作成時に Cognito 側の `name` 属性へ displayName を入れる）は `AdminCreateUser` 呼び出し自体の `UserAttributes` パラメータで満たせる操作であり、BR11.1〜BR11.11・security-design.md・reliability-design.md のどこにも、作成後に Cognito 側の属性を更新する操作（アカウント編集など）は定義されていない。このため `AdminUpdateUserAttributes` が何の操作に対応するのか、本書からは読み取れない | `AdminUpdateUserAttributes` を使う具体的な操作（BR か API）を明記するか、対応する操作が無ければ最小権限の原則（project.md の Mandated「IAM は最小権限」）に沿ってこの権限を外す | Resolved (reviewer) |

> R-01 Reviewer note: `nfr-design/logical-components.md` に U3 と同じ形式の「訂正」注記が追加された。§1 の表が `review`（ReviewDecision／順番②）と `catalog`（ReportListItem／順番①）の2行に分かれ、Mermaid 構成図も `REV`・`CAT` の2ノードに分けて描き直され、テキスト代替・削除の順番と担当関数の対応表も揃った。`infrastructure-specification.md` 側の実際の関数境界（catalogは別関数）との食い違いは解消されている。

> R-02 Reviewer note: `infrastructure-design/traceability.json` の `upstream_ids`／`coverage` に `NFR6.3`（`N/A`／「最初の管理者を作るスクリプトの秘密情報の扱いはU1の設定のまま。インフラの変更なし」）が追加され、`nfr-design/traceability.json` で `status: OK` だった項目が漏れなく引き継がれるようになった。

> R-03 Reviewer note: `infrastructure-specification.md` の `accounts` 関数の行から `AdminUpdateUserAttributes` が削除され、「無効化・有効化は DynamoDB の `Account.status` の書き換えだけで行い、Cognito 側は変更しない」ことと、その根拠（U4 の BR11.8：証明の出し直しの判定は DynamoDB 読み出しで行うため Cognito 側の操作が不要）が明記された。`functional-design/rules.md` の BR11.8（`status=active` の確認による 401 の仕組み）と整合しており、最小権限の原則に沿う形に修正されている。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (手動突き合わせ) R-01再検証：関数境界の表・構成図・テキスト代替 | PASS | §1の表が `review`／`catalog` の2行に分かれ、Mermaid図も `REV`／`CAT` の2ノードで描かれ、テキスト代替も同じ区切りで書き直されている。削除の順番①〜⑤と担当関数の対応表も追加され、`infrastructure-specification.md` の記述と一致する |
| (手動突き合わせ) R-02再検証：NFR6.3のtraceability | PASS | `infrastructure-design/traceability.json` の `upstream_ids` に `NFR6.3` が追加され、`coverage` にも `N/A` として記録されている |
| (手動突き合わせ) R-03再検証：BR11.8との整合 | PASS | `u4-accounts-admin/functional-design/rules.md` BR11.8（`status=active` かどうかをDynamoDB読み出しで判定し、無効なら401）を確認。Cognito側の属性更新が不要という修正後の記述と一致し、`AdminUpdateUserAttributes` への参照は本文中に残っていない |
| (手動突き合わせ) nfr-design↔infrastructure-design traceabilityの整合（広め確認） | PASS | nfr-designで `N/A` の項目（NFR1.1・NFR9.1/9.2・NFR4.1/4.5/4.16・NFR5.5・NFR10.1/10.4・NFR11.3・NFR12.1/12.4・NFR13.1/13.4/13.9/13.11〜13.13・NFR3.2）がinfrastructure-designのupstream_idsに現れないのは、これらがいずれもnfr-design側で既に「対象外」と確認済みのためで、R-02のような見落としではない |

### Summary

iteration 1 の3件（Major 1・Minor 2）はいずれも修正を確認でき、新たな指摘は見当たらない。関数境界の訂正・traceabilityの補完・IAM権限の最小化のいずれも、上流の実際の構成（U1〜U3のinfrastructure-specification）やこのUnitの業務規則（BR11.8）と整合している。Critical 0件・Major 0件のためREADYとする。
