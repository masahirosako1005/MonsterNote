**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T00:00:00Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | construction/u4-accounts-admin/functional-design/rules.md > BR11.3・BR11.4、functional-spec.md > UC21・UC23 | U1 のすでに配備済みの仕組み（nfr-design/security-design.md「NFR6.3」・code-generation-plan.md Step 25）は、アカウント作成スクリプトが Cognito の `AdminCreateUser` を仮のパスワード付きで呼ぶだけで、`AdminSetUserPassword(Permanent=true)` を呼んでいない。その場合 Cognito はユーザーの状態を `FORCE_CHANGE_PASSWORD` にし、次回の `InitiateAuth`（ログイン）は証明を返さず `NEW_PASSWORD_REQUIRED` という別のチャレンジを返す。BR11.3／BR11.4／UC21 は「ログイン(POST /v1/session)で普通に証明が返り、応答の `mustChangePassword` を見て画面でパスワード変更を強制する」という前提で書かれており、Cognito 側のこのネイティブな仕組みにまったく触れていない。管理者が作成・再設定したアカウント（U4 の中心機能）は、設計どおりに実装すると最初のログイン自体が失敗し、UC21（初回の手続き）・UC23（パスワードの再設定）が成立しない。 | BR11.3 に「作成・再設定のたびに `AdminSetUserPassword` を Permanent=true で呼び、Cognito 側のパスワード変更要求を発生させない。`mustChangePassword` はアプリ側（DynamoDB の Account）だけで管理する」ことを明記するか、あるいは `POST /v1/session` が `NEW_PASSWORD_REQUIRED` チャレンジを受け取って処理する流れを BR1.1／BR11.7 に書き足す。どちらを採るか決めて、ログインの応答と仮のパスワードの発行手順を書き直す。 | Resolved (reviewer) |
| R-02 | Critical | construction/u4-accounts-admin/functional-design/rules.md > BR11.9、functional-spec.md > UC24 | BR11.9 の「有効な管理者が 1 人だけのとき、その管理者は無効にできない」は、読み取り→判定→書き込みの逐次ロジックとしてしか書かれておらず、同時実行を防ぐ仕組み（BR11.2 の ID 重複が使う「条件付きの 1 回の書き込み」のようなもの）が一切ない。管理者が 2 人（A・B）だけ有効な状態で、A が B を、B が A を同時に無効化しようとすると、どちらの読み取りも「有効な管理者は 2 人」と見えるため両方とも拒まれず、両方とも成功して有効な管理者が 0 人になりうる。Q5 の意図（「有効な管理者が 1 人だけのとき無効にできない」＝管理者の全滅を防ぐ）そのものを、まさにその決まりの実装方法が満たせていない。管理者が 0 人になると `/v1/admin/...` の全道が BR11.1 で閉じられ、画面からの復旧手段がなくなる（corner-checklist「Concurrency, jobs, and sessions」の「同じ対象への同時操作」に該当）。 | BR11.9 に、DynamoDB の条件付き更新（例: 対象を無効化する直前に「role=admin かつ status=active の件数 ≥ 2」を同一トランザクションの条件に含める、または管理者テーブルに有効管理者数のカウンタを持ち条件付きで減算する）など、同時実行でも矛盾を起こさない具体の仕組みを明記する。 | Resolved (reviewer) |
| R-03 | Major | construction/u4-accounts-admin/functional-design/entities.md > AuditEntry（actorName・outcome）、rules.md > BR12.3、functional-spec.md > 7. 約束との違い | entities.md と BR12.3 は `audit.recorded` を受けたときに `actorName`（表示名の写し）と `outcome`（succeeded/failed）を記録に入れると定めているが、`inception/contract-design/contract-summary.md` の C15 `audit.recorded` のペイロード（`action`・`targetType`・`targetId`・`detail` と、共通の外側にある `actorAccountId`）には、この 2 つの項目がどこにも存在しない。C15 の持ち主は受け手の AuditLog（U4）であり契約を変える権限は U4 にあるが、functional-spec.md の「7. 約束との違い」表（D-1〜D-5）はこの契約拡張を一件も挙げていない。`actorName` をどこから得るか（送り手が付ける／AuditLog が `actorAccountId` から Account を引く）も、`outcome=failed` がいつ・どの操作で発生しうるか（検証に失敗した操作はそもそも知らせを送らないのではないか）も書かれておらず、BR12.3 の記録の正しさが実装時に担保できない。 | C15 のペイロードに `actorName`（または AuditLog 側での Account 参照による解決）と `outcome` の出どころを明記し、「7. 約束との違い」に D-6 として契約拡張を記録する。`outcome=failed` が実際にどの操作・どの経路で発生するかも 1 行で示す。 | Resolved (reviewer) |
| R-04 | Major | construction/u4-accounts-admin/functional-design/rules.md > BR11.2、functional-spec.md > UC22 | U1 のすでに配備済みの仕組み（code-generation/code-summary.md「確認した人の名前」）は、確認（承認）した人の表示名を Cognito の ID トークンの `name` クレームから取っており、その `name` 属性は U1 のスクリプト（BR5.1）が `AdminCreateUser` 実行時に設定している。U4 の UC22（管理者の画面からのアカウント作成、BR11.2）は、U1 のスクリプトに代わってアカウント作成の主経路になるにもかかわらず、Cognito ユーザーの `name` 属性に `displayName` を設定することを一度も述べていない。このまま実装すると、U4 稼働後に作成されるすべてのアカウント（ハンター・依頼元・管理者）の ID トークンに `name` が入らず、U3 のすでに動いている「確認した人の名前」の表示や、AuditEntry.actorName の由来（上記の finding と合わせて）が壊れる。 | BR11.2／UC22 に「アカウント作成時、Cognito の `AdminCreateUser` の `name` 属性に `displayName` を設定する」ことを明記し、U1 の既存の仕組みとの整合を取る。パスワード再設定（UC23）で表示名が変わらないことも確認する。 | Resolved (reviewer) |
| R-05 | Minor | construction/u4-accounts-admin/functional-design/rules.md > BR13.1 の Assumptions、functional-spec.md > UC26 | 「すべて削除」の順番は ReportCatalog（一覧）を最初に、Reporting（報告・写真）を最後に消す設計になっているが、試験運用を止めてから削除する、という前提は技術的に強制されていない（メンテナンスモードや新規報告の受付停止の仕組みがない）。rules.md 自身が「削除は試験運用を止めてから行う前提とする」「止めずに行うと…行が作り直されることがある」と認めているとおり、削除の実行中に新しい報告が送信されると、AC6.5.2 の「一覧は 0 件になる」という受け入れ基準を、削除完了の時点で満たせない可能性がある。 | 「すべて削除」の実行中は新規の報告受付を一時的に止める仕組み（例: Settings に保守フラグを持たせ、Reporting がそれを見て拒む）を追加するか、少なくとも AC6.5.2 の成立が「試験運用を止めていること」に依存する旨を明記し、画面にもその注意を出す。 | Resolved (reviewer) |
| R-06 | Minor | construction/u4-accounts-admin/functional-design/rules.md > BR12.4、entities.md > AuditEntry | AuditEntry は `actorName`（ハンター・依頼元の表示名という個人情報）を含み、Q3 の決定（BR12.4・BR13.3）により「すべて削除」の対象からも、それ以外のどの削除手段からも永久に除外される。requirements.md の NFR14 は NFR11（報告・写真の保存期間）と同じ言い回し「試験運用が終わるまで保存する」を使っており、NFR11 側は明示的に「終了後に…削除する」としているのに対し、AuditEntry には永久保持以外の選択肢・将来の削除手順が一切記されていない。試験運用後に個人情報を残さないという FR10.2／NFR11 の趣旨と、operation.md の「個人情報の最小化」の精神に照らすと、記録の中の表示名を将来どう扱うかが未定のままになっている。 | AuditEntry.actorName を永久に残す設計である旨と、その理由（試験運用の振り返り用）を NFR14 との関係とあわせて明記するか、将来（教材としての利用が終わった後）に表示名だけを匿名化・削除する手順を運用手順として記録しておく。 | Resolved (reviewer) |
| R-07 | Critical | construction/u4-accounts-admin/functional-design/entities.md > AdminCounter、rules.md > BR11.2・BR11.11、functional-spec.md > UC22・UC28の前提・Assumptions | entities.md の `AdminCounter.activeAdminCount` は「管理者を作る・有効に戻すと 1 増え、無効にすると 1 減る」と説明しているが、実際に「1 増える」操作を行うのは BR11.9／UC24 の「有効に戻す」だけである。通常の管理者作成（BR11.2・UC22、2 人目以降の正式な作成経路）にも、最初の管理者を作るスクリプト（BR11.11）にも、AdminCounter を増やす・初期化する手順が一行もない（functional-spec.md の「スクリプトで作るときに 1 で作る」は Assumptions の中の一文でしかなく、BR11.11 自体の logic には書かれていない）。このままでは、admin ロールのアカウントがいくつ作られても AdminCounter は増えず、BR11.9 の「2 以上であることを条件に 1 減らす」書き換えは、カウンタが初期化もされない・正しい数にもならないために常に失敗しうる。その結果、R-02 で直したはずの「無効化できる」という振る舞い自体が、どの管理者に対しても働かなくなる（同時実行の有無によらず、通常の単独操作でも失敗する）おそれがある。これは R-02 の repair が生んだ新しい、より重大な欠陥である。 | BR11.2（画面からの管理者作成）と BR11.11（スクリプトでの最初の管理者作成）の logic に、「role=admin で作成が成功したら AdminCounter.activeAdminCount を 1 増やす（存在しなければ 1 で新しく作る）」と明記する。スクリプトでの初期化を Assumptions ではなく BR11.11 本文の決まりとして格上げする。 | New |
| R-08 | Minor | construction/u4-accounts-admin/functional-design/rules.md > Assumptions & Open Questions（BR11.9 の行） | 「BR11.9 の『有効な管理者が 1 人だけ』の判定は、アカウントの一覧から role=admin かつ status=active の数を数えて行う」という旧方式の assumption が、repair 後もそのまま残っている。本文の BR11.9 は「数えてから書く形にしない」と明記しており、この assumption と直接矛盾する。読み手（特に Code Generation）がどちらの方式を実装すべきか迷う。 | この assumption の行を削除するか、「この数え上げ方式は採らず、AdminCounter への条件付き書き込みに置き換えた（レビュー R-02）」と書き直す。 | New |
| R-09 | Minor | construction/u4-accounts-admin/functional-design/functional-spec.md > 7. 約束との違い D-6、inception/contract-design/contract-summary.md > 2.4 知らせの共通の外側 | D-6 は「C15 は action・targetType・targetId・detail しか持っていなかった」とし、`actorAccountId` と `occurredAt` も今回新しく足す項目であるかのように書いているが、この 2 つは contract-summary.md の 2.4「知らせの共通の外側（EventEnvelope）」にすでに定義されており、`audit.recorded` を含むすべての知らせがもとから持っている（`data` の中身ではなく、知らせの外側の項目）。実際に `audit.recorded` の `data` に新しく足す必要があるのは `actorName` と `outcome` の 2 つだけである。 | D-6 の記述を、「C15 の中身（`data`）に `actorName` と `outcome` を足す。`actorAccountId` と `occurredAt` は知らせの共通の外側にすでにあり、AuditLog はそこから取れる」という形に直す。 | New |

> R-01 Reviewer note: 指摘した事実（スクリプトが `AdminSetUserPasswordCommand(Permanent: true)` を呼んでいない）は誤りだった（`scripts/create-account.ts` で確認済み）。ただし本質の指摘（「仮のパスワードかどうか」をどちらの保存先が覚えるか未定）は正しく、今回の repair で解消されている。D-7（functional-spec.md §7）・BR11.3・BR11.4・entities.md の `mustChangePassword` 注記が、Cognito 側は常に「変更を求めない」状態で設定し、アプリ側の `mustChangePassword` だけが仮パスワードかどうかを覚える、と一貫して書かれている。UC22 手順 4 にも同じ手当てがある。

> R-02 Reviewer note: BR11.9・UC24 手順 2 が、AdminCounter を「2 以上であること」を条件にした 1 回の書き込みで減らし、成功したときだけ status を変える形に直っている。数えてから書く旧方式を明示的に退け、同時に互いを無効化するケースの角のケース行も追加されている。元の指摘（同時無効化で有効な管理者が 0 人になりうる）はこの仕組みで防げる。ただし、この仕組み自身に新しい欠陥がある（下記 R-07 を参照）。

> R-03 Reviewer note: functional-spec.md §7 に D-6 として、C15 の `audit.recorded` の中身に `actorName`・`outcome` を足す契約変更が記録され、entities.md の `actorName` 注記もそこを指している。本来の指摘（actorName・outcome の出どころが未定）は解消された。ただし D-6 の記述そのものに不正確な点がある（下記 R-09 を参照）。

> R-04 Reviewer note: BR11.2・UC22 手順 4 に「認証のサービス側の `name` に displayName を入れる」ことと、U3 の「確認した人」の表示がそこから名前を取るという理由が明記された。functional-spec.md §6 の角のケース表にも「入れ忘れると名前が出ない」の行が追加されている。

> R-05 Reviewer note: BR13.1・UC26 手順 7 に、5 つの削除が終わったあとに報告・一覧の件数を数え直し、0 件でなければやり直しを促す手順が追加された。frontend-components.md の `DeleteProgress` にも同じ振る舞いが書かれており、AC6.5.2（「一覧は 0 件になる」）に、試験運用を止め忘れても到達できる設計になっている。

> R-06 Reviewer note: BR12.4・entities.md の `AuditEntry` 制約に、記録に残る個人情報は表示名だけであること、試験運用そのものを終えるときは AWS の環境ごと片付ける（`cdk destroy`）ことで記録も消えること、記録だけを先に消す入口は作らないことが明記された。「操作の記録は永久にどこからも消せない」という元の懸念に、具体的な終わらせ方が示されている。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （このステージの定義に検証ツールの指定なし） | 実行せず | 本レビューは、repair 後の entities.md・rules.md・functional-spec.md・frontend-components.md・traceability.json と、U1 のすでに配備済みのコード（`scripts/create-account.ts`）、inception の contract-summary.md（2.4 の共通の外側を含む）との突合によって行った |

### Summary

前回の 6 件はいずれも実際に直っており、R-01 については自分の指摘自体に事実誤認があったことも確認できた。しかし R-02 の repair（AdminCounter の導入）が、作成時にカウンタを増やす手順をどこにも書いていないという新しい欠陥を生んでおり、これは当初の「同時無効化で管理者が 0 人になる」よりも広い範囲で、通常の単独操作でも管理者を無効化できなくなりうる Critical な抜けのため、NOT-READY とする。D-6 の記述の不正確さと、BR11.9 の Assumptions に残る矛盾した旧説明は、実装を誤らせうる Minor な指摘として合わせて報告した。
