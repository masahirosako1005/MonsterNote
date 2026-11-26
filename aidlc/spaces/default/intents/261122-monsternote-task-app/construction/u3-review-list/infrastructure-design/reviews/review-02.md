**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T09:41:22Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u3-review-list/infrastructure-design/infrastructure-specification.md §2「Infrastructure Services」の Lambda `review`・DynamoDB `ReportListItems` の行 | `GET /v1/catalog/reports`（絞り込み一覧）の処理を Review 関数に追加し、「既存の IAM 権限（`ReviewDecisions`・`ReportListItems` への読み書き）のまま、新しい権限は不要」としているが、これは U1 の確定した構成と矛盾する。`inception/domain-design/components.md`（部品の一覧の表、行589〜590）は「一覧の組み立て（読み出し専用）」を ReportCatalog の責務とし、`ReportListItem` はその所有エンティティとしている。`inception/contract-design/contract-summary.md`（C4）も `/v1/catalog/reports`・`/v1/catalog/my-reports` を ReportCatalog の契約として列挙している。さらに U1 の `construction/u1-skeleton/infrastructure-design/infrastructure-specification.md` §2 では、DynamoDB の表ごとに利用できる関数を明記しており、`ReviewDecisions` は「Review の関数だけ」、`ReportListItems` は「ReportCatalog の関数だけ」と、はっきり別の関数に分けている（Lambda の行でも `review` と `catalog（API）` は別の関数として列挙）。つまり U1 で確定した時点では、Review 関数は `ReportListItems` への IAM 権限を一切持っていない。U3 の infrastructure-specification.md は、この表の所有権をそのまま Review 関数に移す（しかも「新しい権限は不要」と明言する）形になっており、実装するとそもそも Review 関数に `ReportListItems` への読み取り権限が存在せず、絞り込み一覧の呼び出しが IAM の AccessDenied で失敗する。これは Q1-A（U3 の nfr-design で承認済み）の前提自体の誤りを infra-design がそのまま具体化したものだが、CDK の構成・IAM ポリシーとして確定させるのはこの Infrastructure Design の文書であるため、ここで直すべき。 | 絞り込み一覧（`GET /v1/catalog/reports`・`GET /v1/catalog/my-reports`）の処理は、U1 の確定構成・components.md・contract-summary.md の所有権どおり ReportCatalog（`catalog` Lambda）に実装する前提に修正する。Review 関数には却下・取り消しの処理のみを追加し、ReportListItems への新しい IAM 権限が必要なら `catalog` Lambda 側に正しく記載する。この変更は nfr-design の logical-components.md（L4 の役割の記述）にも影響するため、必要なら nfr-design 側にも修正を差し戻す。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u3-review-list/infrastructure-design/infrastructure-specification.md §2「API Gateway HTTP API」の行 | functional-spec.md の D-2（§7「約束との違い」）は `GET /v1/catalog/reports` と `GET /v1/catalog/my-reports` の両方の行に緯度・経度を足すとしているが、§2 の API Gateway の道の一覧には `GET /v1/catalog/my-reports` がまったく挙がっていない。`GET /v1/catalog/reports` だけが「既存の道を拡張」として記載されており、D-2 が約束する my-reports 側の応答拡張がインフラ仕様の道の一覧から漏れている。 | `GET /v1/catalog/my-reports` も §2 の表に行として追加し、D-2 の緯度・経度の拡張が及ぶことを明記する。 | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u3-review-list/infrastructure-design/traceability.json upstream_ids 配列・coverage 配列の `NFR9.4` | `NFR9.4` という ID は U3 のどの nfr-requirements・nfr-design にも実在しない。`performance-design.md` の冒頭「入力」欄にある「NFR7.5〜NFR9.4」という範囲表記（実際の最後の項目は NFR7.7 までで、NFR9.4 は存在しない）をそのまま ID として拾ってしまったとみられる誤った参照。 | `NFR9.4` を upstream_ids・coverage から除き、実在する ID（NFR7.5〜NFR7.7 など、すでに別途列挙されている）だけを残す。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u3-review-list/nfr-design/logical-components.md（L4 の行・図・テキスト代替・箇条書き）、performance-design.md（§1 冒頭・assumptions）、scalability-design.md（Review 関数のメモリの段落）、observability-design.md（アラームの assumption） | インフラ仕様は R-01 の修正で「絞り込み一覧は `catalog` 関数が担当する」に訂正されたが、同じ U3 の nfr-design 側の複数のファイルは今回書き換えられておらず、依然として「却下・取り消し・絞り込み一覧の処理を同じ Review 関数に足す」という訂正前の前提のまま残っている（例: logical-components.md の L4 行・Mermaid 図・テキスト代替、observability-design.md の「U3 で足す処理（却下・取り消し・絞り込み一覧）も同じ Review 関数の中にあるため」という assumption）。実際の数値面では両関数のメモリ・時間切れが U1 で同一（128 MB／8 秒）で、エラーアラームも「全関数の合計」のため実害は生じていないが、nfr-design と infrastructure-design という同じ Unit 内の2つの確定文書が、どの関数が絞り込み一覧を処理するかについて正面から食い違ったまま残っている。infrastructure-specification.md は訂正の経緯を Notes 欄に明記しているが、nfr-design 側のファイル群には対応する注記がなく、先に nfr-design を読んだ実装者が誤った前提を持ち帰る可能性がある。 | nfr-design 側の該当箇所（logical-components.md L4 の説明・図・テキスト代替、performance-design.md・scalability-design.md・observability-design.md の「同じ Review 関数」という記述）に、infrastructure-specification.md が行った訂正（絞り込み一覧は `catalog` 関数が担当）を指す短い注記を足すか、該当する記述を `catalog` 関数に正しく付け替える。数値（メモリ・時間切れ・アラームの扱い）自体は変更不要。 | New |

> R-01 Reviewer note: infrastructure-specification.md §2 を確認した。U1 の infrastructure-specification.md（`review`・`catalog（API）` は別々の関数で、`ReviewDecisions` は Review の関数だけ、`ReportListItems` は ReportCatalog の関数だけ）どおりに訂正されている。承認・却下・取り消し・状態読み出し（`PUT /v1/reviews/{id}/decision`、`POST .../undo`、`GET /v1/reviews/{id}`）は引き続き `review` 関数（IAM は `ReviewDecisions` への読み書きのまま、`ReportListItems` へのアクセスは持たせない）、一覧・絞り込み（`GET /v1/catalog/reports`・`GET /v1/catalog/my-reports`）は既存の `catalog` 関数（IAM は `ReportListItems` への読み書きのまま）に配置されており、表ごとの IAM の境界が正しく保たれている。cicd-pipeline.md §1 の CDK 構成試験にも「`catalog` 関数が `ReviewDecisions` への権限を持たず、`review` 関数が `ReportListItems` への権限を持たないこと」が明記され、この境界の崩れを検出できる形になっている。U1 の両関数はメモリ・時間切れとも 128 MB／8 秒で同一のため、関数の割り当てを訂正しても性能予算（NFR2.12〜NFR2.14）の見積もりに影響はない。

> R-02 Reviewer note: infrastructure-specification.md §2「API Gateway HTTP API」の表に `GET /v1/catalog/my-reports`（既存の道。D-2 により応答の行に緯度・経度を足す。担当: `catalog`）の行が追加されている。functional-spec.md の D-2（`GET /v1/catalog/reports`・`my-reports` の両方の行に緯度・経度を足す）と一致する。

> R-03 Reviewer note: traceability.json の `upstream_ids` 配列・`coverage` 配列から `NFR9.4` が削除されている。残る ID（NFR7.5〜NFR7.7 を含む）はすべて実在する ID である。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (手動突き合わせ) | R-01〜R-03 の修正箇所を infrastructure-specification.md・monitoring-design.md・cicd-pipeline.md・traceability.json と、U1 の infrastructure-specification.md・functional-spec.md（D-2）に照らして確認し、3件とも解消を確認。合わせて nfr-design 側の整合性を広く確認し、1件の Minor な文書間の食い違いを発見した | 自動検証ツールの指定なし。手動の突き合わせで検出 |

### Summary

iteration 1 の Critical・Major・Minor の3件はいずれも修正されており、Review 関数と ReportCatalog（`catalog` 関数）の IAM 境界を崩さない形で絞り込み一覧の担当が正しく訂正され、`my-reports` の抜けと誤った NFR ID も解消されている。残るのは、nfr-design 側の複数ファイルに訂正前の「同じ Review 関数」という前提が文章として残っている点（Minor）のみで、数値や実装上の実害はないため READY とする。
