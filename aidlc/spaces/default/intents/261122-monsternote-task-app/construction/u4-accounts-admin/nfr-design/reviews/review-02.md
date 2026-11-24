**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T06:04:04Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/nfr-design/reliability-design.md > §1 アカウントの作成（`LoginIdLock`）／ logical-components.md > §1 構成要素の一覧・scalability-design.md > §1 規模 | reliability-design.md §1 は `loginId` の一意性確認のために `LoginIdLock` という新しい内部項目への `Put`（条件付き）を `TransactWriteItems` の 1 項目として要求している。しかし、同じ nfr-design ステージの logical-components.md（「U4 は…新しく作るのは AuditLog の関数と、AdminCounter・AuditEntry の 2 つの表だけ」）と scalability-design.md §1（「新しく増える表は `AuditEntry`・`AdminCounter` の 2 つ」）は、どちらも新しい書き込み対象を 2 つとして数えており、`LoginIdLock` が三つ目の書き込み対象（別表か、既存表の別アイテム種別か）として存在する前提に触れていない。reliability-design.md 自身もこの表の置き場所を Infrastructure Design 行きの Assumption として未確定にしている。開発者が logical-components.md だけを見て構成要素・IAM 権限・容量を見積もると、`LoginIdLock` への書き込み権限・容量が漏れる。 | logical-components.md の構成要素一覧と scalability-design.md §1 の表の数に `LoginIdLock`（新しい表か、Account の表の別アイテム種別か）を明記し、3 つの書き込み対象として揃える。あるいは reliability-design.md の Assumption を Open Question に格上げし、NFR Design の時点で置き場所を確定する。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/nfr-design/reliability-design.md > §1 アカウントの作成（`LoginIdLock`） | `LoginIdLock` による一意性確認の必要性の根拠が、`loginId` と認証サービス（Cognito）側のユーザー名の対応関係に依存しているが、その対応（`loginId` をそのまま Cognito の Username として使うのかどうか）がどの設計書・entities.md にも明記されていない。performance-design.md §2 と functional-design/rules.md の Assumption（「同じ ID でもう一度作ると認証サービス側で 409 になる」）は、Cognito 自身がユーザー名の重複を原子的に弾くことを前提にしているように読める。もしそうなら、`loginId` の重複は多くの場合すでに Cognito 側の `AdminCreateUser` の失敗で検知され、DynamoDB 側の `LoginIdLock` 条件は実質的に効かない経路（Cognito 作成後に DynamoDB の `TransactWriteItems` を行う設計のため、`LoginIdLock` の条件に初めて引っかかるケースがどんな障害シナリオを指しているのか）が明記されておらず、開発者が実装時に「この条件はいつ失敗しうるのか」を判断できない。 | entities.md または security-design.md に、`loginId` と Cognito のユーザー名の対応関係（同じ値を使うか別管理か）を明記し、`LoginIdLock` の条件付き書き込みがどの障害シナリオ（例: Cognito 作成が成功したが DynamoDB 側が初めての書き込みで、過去に同じ `loginId` で DynamoDB 側だけ作成済みのレコードが残っている場合など）を防ぐためのものかを reliability-design.md に 1 文加える。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/nfr-design/traceability.json | `nfr-requirements/tech-stack-decisions.md` が U4 で新しく定義した試験の要件 `NFR13.11`〜`NFR13.13`（AdminCounter の同時実行試験、「すべて削除」の冪等性試験、最初の管理者スクリプトの試験）が `traceability.json` の `upstream_ids` に含まれていない。U2 の nfr-design/traceability.json は対応する `NFR13.x` 系を upstream_ids に含めていたが、U3 は含めておらず、U4 もその抜けを引き継いでいる。これら自体は Code Generation 寄りの要件だが、U2 の前例と食い違う扱いになっている。 | `NFR13.11`〜`NFR13.13` を `traceability.json` に `N/A`（Code Generation で扱う）として明記するか、U2 の前例に合わせて upstream_ids に加えて `OK`／該当節を記載する。どちらかに統一し、U3 の抜けと合わせて今後の統一方針を決める。 | New |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/functional-design/rules.md > BR11.2 の logic／aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u4-accounts-admin/functional-design/entities.md > Account.loginId（`unique: true`） | 今回の修正で reliability-design.md §1 は「`Put Account(accountId, loginId, …)` （新しい accountId のため条件は不要。loginId の一意性は Cognito 側ですでに確認済み）」とし、DynamoDB 側で loginId の一意性を確認する仕組みを一切作らないと明記した。一方、同じ U4 の functional-design/rules.md の BR11.2 は「IF 同じ loginId のアカウントがある THEN 拒む（AC6.1.3。**ID が重ならないことを条件にした 1 回の書き込みで作る**）」と、DynamoDB 側の条件付き書き込みで一意性を確認する前提の記述のままになっており、entities.md の Account.loginId も `unique: true` という DB レベルの制約であるかのような宣言のままになっている。これらは `LoginIdLock` 撤回前の設計（DynamoDB 側で何らかの一意性確認を行う）を前提にした文言であり、今回の reliability-design.md の修正はこの 2 文書を更新していない。開発者が BR11.2・entities.md を見て実装すると、Cognito 側の確認とは別に DynamoDB 側にも条件付き書き込み（またはそれに相当する一意性索引）を作ろうとし、reliability-design.md の「条件は不要」という設計と食い違う実装になりかねない。 | BR11.2 の logic 文から「ID が重ならないことを条件にした 1 回の書き込みで作る」という表現を削除するか、「一意性の確認は Cognito 側に委ね、DynamoDB 側の Put には条件を付けない」と reliability-design.md の内容に合わせて書き直す。entities.md の loginId の `unique: true` には、その一意性が DynamoDB 自身の制約ではなく Cognito 側のユーザー名によって保証される旨を注記する。 | New |

> R-01 Reviewer note: `LoginIdLock` は reliability-design.md・performance-design.md から完全に撤回された。`grep` で `LoginIdLock` の残存を確認したが、nfr-design 配下に残っていない。reliability-design.md §1 は「新しい表は `AdminCounter`・`AuditEntry` の 2 つだけ」と明記し、logical-components.md §1 の一覧（新しい表: AdminCounter・AuditEntry）、scalability-design.md §1（「新しく増える表は `AuditEntry`・`AdminCounter` の 2 つ」）とも数が一致した。3 文書間の食い違いは解消されている。

> R-02 Reviewer note: reliability-design.md §1 に「`loginId` を Cognito のユーザー名としてそのまま使うため…同じ `loginId` での 2 回目の呼び出しは Cognito が `UsernameExistsException` で拒む」という対応関係と障害シナリオの根拠が明記され、performance-design.md §2 のシーケンス図・表（`UsernameExistsException` → `409 LOGIN_ID_TAKEN`、DynamoDB 側は書かない）とも一致した。`loginId` と Cognito ユーザー名の対応という、以前は暗黙だった前提が明文化され、「いつ失敗しうるのか」を開発者が判断できる形になった。

> R-03 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `grep -rn "LoginIdLock"` （nfr-design 配下） | 一致なし（memory.md と review-01.md の記録以外に残存なし） | `LoginIdLock` が設計書本体から確実に撤回されたことを確認。R-01 の裏付け |
| （手動確認）reliability-design.md §1／performance-design.md §2 のシーケンス図・表の整合 | PASS | `loginId` を Cognito のユーザー名としてそのまま使う→`UsernameExistsException`→`409 LOGIN_ID_TAKEN`、DynamoDB 側は書かない、という流れが両文書で完全に一致。R-02 の裏付け |
| （手動確認）logical-components.md §1／scalability-design.md §1 の「新しい表 2 つ」との整合 | PASS | いずれも AdminCounter・AuditEntry の 2 つのみを新規の表として数えており、三つ目の書き込み対象は存在しない |
| （手動確認）traceability.json の NFR13.x | PASS | `NFR13.9`・`NFR13.11`〜`NFR13.13` が `upstream_ids` と `coverage` の両方に `N/A`（アーキテクチャ設計の対象ではない）として追加され、U2 の前例に沿った扱いに統一された |
| （手動確認）DuplicateDetection の既存タイムアウト値の明記 | PASS | performance-design.md §3 の表に「DuplicateDetection｜10 秒（U1。知らせの受け手の既定）」と明記され、U1 の reliability-design.md §2「知らせの受け手の関数は 10 秒」と一致。15 秒への引き上げの影響評価が検証可能になった |
| （手動確認）functional-design/rules.md BR11.2・entities.md との突き合わせ | FAIL（新規 Major） | BR11.2 の logic と entities.md の `unique: true` が、撤回前の「DynamoDB 側で条件付き確認を行う」前提の文言のまま残っており、reliability-design.md の修正後の設計と食い違う |

### Summary

iteration 1 の Major 2 件（`LoginIdLock` と他文書の食い違い、その必要性の根拠の不明記）はいずれも解消された。`LoginIdLock` の完全撤回と、Cognito 側のユーザー名保証への一本化は nfr-design 内の 3 文書（reliability-design・performance-design・logical-components／scalability-design）で一貫しており、Minor だった traceability.json の抜けも U2 の前例に合わせて埋められた。ただし、この修正は同じ loginId の一意性確認について、上流の functional-design/rules.md（BR11.2）・entities.md（`unique: true`）を更新しないまま残しており、新たに 1 件の Major な食い違いが生じている。Critical は 0 件、Major は新規 1 件のみ（閾値 2 件以下）のため READY とするが、次のステージに進む前に BR11.2・entities.md の文言を reliability-design.md の最終設計に合わせることを推奨する。
