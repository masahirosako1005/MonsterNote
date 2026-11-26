**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T05:59:48Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/nfr-design/reliability-design.md > §1 アカウントの作成（`LoginIdLock`）／ logical-components.md > §1 構成要素の一覧・scalability-design.md > §1 規模 | reliability-design.md §1 は `loginId` の一意性確認のために `LoginIdLock` という新しい内部項目への `Put`（条件付き）を `TransactWriteItems` の 1 項目として要求している。しかし、同じ nfr-design ステージの logical-components.md（「U4 は…新しく作るのは AuditLog の関数と、AdminCounter・AuditEntry の 2 つの表だけ」）と scalability-design.md §1（「新しく増える表は `AuditEntry`・`AdminCounter` の 2 つ」）は、どちらも新しい書き込み対象を 2 つとして数えており、`LoginIdLock` が三つ目の書き込み対象（別表か、既存表の別アイテム種別か）として存在する前提に触れていない。reliability-design.md 自身もこの表の置き場所を Infrastructure Design 行きの Assumption として未確定にしている。開発者が logical-components.md だけを見て構成要素・IAM 権限・容量を見積もると、`LoginIdLock` への書き込み権限・容量が漏れる。 | logical-components.md の構成要素一覧と scalability-design.md §1 の表の数に `LoginIdLock`（新しい表か、Account の表の別アイテム種別か）を明記し、3 つの書き込み対象として揃える。あるいは reliability-design.md の Assumption を Open Question に格上げし、NFR Design の時点で置き場所を確定する。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/nfr-design/reliability-design.md > §1 アカウントの作成（`LoginIdLock`） | `LoginIdLock` による一意性確認の必要性の根拠が、`loginId` と認証サービス（Cognito）側のユーザー名の対応関係に依存しているが、その対応（`loginId` をそのまま Cognito の Username として使うのかどうか）がどの設計書・entities.md にも明記されていない。performance-design.md §2 と functional-design/rules.md の Assumption（「同じ ID でもう一度作ると認証サービス側で 409 になる」）は、Cognito 自身がユーザー名の重複を原子的に弾くことを前提にしているように読める。もしそうなら、`loginId` の重複は多くの場合すでに Cognito 側の `AdminCreateUser` の失敗で検知され、DynamoDB 側の `LoginIdLock` 条件は実質的に効かない経路（Cognito 作成後に DynamoDB の `TransactWriteItems` を行う設計のため、`LoginIdLock` の条件に初めて引っかかるケースがどんな障害シナリオを指しているのか）が明記されておらず、開発者が実装時に「この条件はいつ失敗しうるのか」を判断できない。 | entities.md または security-design.md に、`loginId` と Cognito のユーザー名の対応関係（同じ値を使うか別管理か）を明記し、`LoginIdLock` の条件付き書き込みがどの障害シナリオ（例: Cognito 作成が成功したが DynamoDB 側が初めての書き込みで、過去に同じ `loginId` で DynamoDB 側だけ作成済みのレコードが残っている場合など）を防ぐためのものかを reliability-design.md に 1 文加える。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/nfr-design/traceability.json | `nfr-requirements/tech-stack-decisions.md` が U4 で新しく定義した試験の要件 `NFR13.11`〜`NFR13.13`（AdminCounter の同時実行試験、「すべて削除」の冪等性試験、最初の管理者スクリプトの試験）が `traceability.json` の `upstream_ids` に含まれていない。U2 の nfr-design/traceability.json は対応する `NFR13.x` 系を upstream_ids に含めていたが、U3 は含めておらず、U4 もその抜けを引き継いでいる。これら自体は Code Generation 寄りの要件だが、U2 の前例と食い違う扱いになっている。 | `NFR13.11`〜`NFR13.13` を `traceability.json` に `N/A`（Code Generation で扱う）として明記するか、U2 の前例に合わせて upstream_ids に加えて `OK`／該当節を記載する。どちらかに統一し、U3 の抜けと合わせて今後の統一方針を決める。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (手動確認) AdminCounter の条件式（作成・無効化・有効化・最初の管理者） | PASS | reliability-design.md §1 の 4 つの `TransactWriteItems`（作成時 +1、無効化時「≥2 を条件に -1」、有効化時「status=:disabled を条件に +1」、最初の管理者 `if_not_exists` で +1）は、functional-design/rules.md の BR11.2・BR11.9・BR11.11 およびそのAssumptions（レビュー R-02・R-07・R-10 の裏付け）と論理が一致しており、過去の再発パターン（数えてから書く、片方だけ成功する）はいずれも再発していない |
| (手動確認) Reporting・Review 関数のタイムアウト 9 秒／8 秒 → 15 秒への引き上げ | PASS（条件付き） | U2 の Reporting（既存 9 秒）・U1 の Review（既存 8 秒）それぞれの既存ルートの最悪見込みが performance-design.md §3 の表に明記され、いずれも 15 秒に対して十分な余裕があることを確認。ただし DuplicateDetection は既存の関数タイムアウト値そのものが U2 のどの設計書にも明記されておらず、この関数についてだけは「影響なし」の評価の前提（引き上げ前の値）を検証できない（上記 Major findings の 2 件目と関連はしないが、同じ §3 の「影響評価」の十分性にかかわる点として記録） |
| (手動確認) Cognito 呼び出し順序（Q3-A） | PASS | performance-design.md §2 のシーケンス図・表と、nfr-design-questions.md の Q3-A の回答、functional-design/rules.md の Assumption（同じ ID で再作成すると認証サービス側で 409 になる）は、いずれも「Cognito 先行・成功後に DynamoDB」という同じ前提で一致している |
| (手動確認) traceability.json の観測性 ID の手作業追加（NFR10.31・NFR10.32・NFR11.21〜11.24・NFR14.5〜14.7） | PASS | 7 件すべてが upstream_ids と coverage の両方に記載され、対応する節（observability-design.md の該当箇所）が正しく指されている。欠落は見当たらない（NFR13.x の扱いは上記 Minor finding を参照） |

### Summary

AdminCounter の条件付き書き込み（過去 3 回のバグの再発パターン）、関数タイムアウトの引き上げの影響評価、Cognito の呼び出し順序はいずれも上流（functional-design・U2/U3 の既存設計）と整合しており、繰り返されたバグの型は再発していない。一方で、`LoginIdLock` という新しい内部実装が、同じステージ内の logical-components.md・scalability-design.md の「新しい表は 2 つだけ」という記述と食い違ったまま置かれており、その必要性の根拠（Cognito 側のユーザー名との対応）も明文化されていない。Critical は 0 件、Major は 2 件で閾値（2 件以下は READY）の範囲内のため、READY とするが、次のステージに進む前に Major 2 件の手当てを推奨する。
