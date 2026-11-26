# Infrastructure Specification（AWS の構成）— U4 `u4-accounts-admin`

入力: `construction/u4-accounts-admin/nfr-design/`（logical-components、performance・security・scalability・reliability・observability-design）、`construction/u4-accounts-admin/functional-design/functional-spec.md`、`inception/domain-design/components.md`、`construction/u1-skeleton/infrastructure-design/infrastructure-specification.md`（U1 の構成）、`construction/u2-report-duplicate/infrastructure-design/`・`construction/u3-review-list/infrastructure-design/`（U2・U3 で足した構成。ここに続けて足す）。

U4 は、U1〜U3 の 5 つのスタックをそのまま使う。新しく作るのは AuditLog の関数と、AdminCounter・AuditEntry の 2 つの表だけ（U4 の nfr-design の決定）。削除の 5 つの入口は、既存の `catalog`・`review`・`duplicate-detection`・`reporting` の 4 つの関数に足す（U1 の実際の関数の分け方は `review` と `catalog` が別々であることを U3 の Infrastructure Design で確認済み。ここではその正しい区切りに沿って配置する）。

## 1. Deployment（U1〜U3 からの差分）

| Facet | Choice | Rationale |
|---|---|---|
| Resource sizing（更新） | `review`・`catalog`・`reporting`・`duplicate-detection` の 4 関数の時間切れを **15 秒**に統一する（削除の入口を足すため。U4 の performance-design） | performance-design §3 |
| 一意性の確認 | `loginId` の重複は Cognito 側の `AdminCreateUser` が保証する。DynamoDB 側に別の一意性確認の仕組みは作らない（U4 の reliability-design、レビューで確定） | reliability-design §1 |

## 2. Infrastructure Services（U4 で足すもの）

| Service | Role | Configuration | Notes |
|---|---|---|---|
| DynamoDB `AdminCounter`（新規） | データ | キー `counterKey`（1 行）。`activeAdminCount`・`updatedAt` | `accounts` 関数だけ |
| DynamoDB `AuditEntries`（新規） | データ | キー `entryId`。`eventId` を条件にした一意な書き込み（BR12.2）。索引: 発生日時の新しい順（一覧用）。TTL なし、`RemovalPolicy: RETAIN`（NFR11.19） | `audit-log` 関数だけ |
| Lambda `accounts`（既存。更新） | 処理 | メモリ・時間切れは変えない（128 MB、8 秒）。管理者の画面からのアカウント作成・無効化・有効化・パスワード再設定の処理を足す。IAM に Cognito の `AdminCreateUser`（作成）・`AdminSetUserPassword`（作成時の仮のパスワード・パスワード再設定。BR11.3）を追加。`AdminCounter` への読み書き権限を追加。**無効化・有効化は DynamoDB の `Account.status` の書き換えだけで行い、Cognito 側は変更しない**（U1 の BR11.8 のとおり、無効化は証明の出し直しの判定〈DynamoDB の読み出し〉で防ぐ仕組みのため、Cognito 側の操作は不要。最小権限の原則により `AdminUpdateUserAttributes`・`AdminDisableUser` などは付与しない） | 最初の管理者はスクリプト、2 人目以降はこの関数経由（BR11.11・BR11.2） |
| Lambda `audit-log`（新規） | 処理 | 128 MB、時間切れ 10 秒（U1 の「知らせの受け手」の既定）。`AuditEntries` への読み書き権限、EventBridge から `audit.recorded` を受ける | `GET /v1/admin/audit-entries` の読み出しもこの関数が担当 |
| Lambda `catalog`（既存。更新） | 処理 | 時間切れ 8 秒 → **15 秒**（削除の入口を足すため）。メモリは変えない。`ReportListItems` への削除（`BatchWriteItem`）権限を追加（既存の読み書き権限で足りる） | **U1 の構成の訂正を踏まえた配置**: U4 の nfr-design/logical-components.md は当初「Review 関数（ReportCatalog を含む）」という誤った前提で書かれていたが、実際の U1・U3 の構成では `review`（ReviewDecision）と `catalog`（ReportListItem）は別々の関数（U3 の Infrastructure Design で確定済み・nfr-design も同じ形式で訂正済み）。削除の順番①（一覧／ReportCatalog）は、この実際の境界どおり `catalog` 関数に置く |
| Lambda `review`（既存。更新） | 処理 | 時間切れ 8 秒 → **15 秒**。メモリは変えない。`ReviewDecisions` への削除権限を追加 | 削除の順番②（確認の記録）を担当 |
| Lambda `duplicate-detection`（既存。更新） | 処理 | 時間切れ 10 秒 → **15 秒**。メモリは変えない。`ReportFootprints`・`DuplicateSuspicions` への削除権限を追加 | 削除の順番③（重複の索引と疑い）を担当 |
| Lambda `reporting`（既存。更新） | 処理 | 時間切れ 9 秒 → **15 秒**。メモリは変えない。`DetectionResults`・`Report`・`Photo` への削除権限、写真の S3 への `DeleteObjects` 権限を追加 | 削除の順番④（判別の結果。SpeciesDetection のロジックを含む）・⑤（報告と写真）を担当。2 つの論理的な削除対象を 1 つの関数の中で順に処理する |
| API Gateway HTTP API（既存。道を追加） | 入口 | `GET /v1/admin/accounts`（一覧）、`POST /v1/admin/accounts`（作成）、`PUT /v1/admin/accounts/{id}/status`（無効化・有効化）、`POST /v1/admin/accounts/{id}/password-reset`、`GET /v1/admin/audit-entries`（一覧）、`POST /v1/admin/catalog-data`・`/v1/admin/review-data`・`/v1/admin/duplicate-data`・`/v1/admin/detection-data`・`/v1/admin/reporting-data`（5 つの削除の入口。それぞれ担当の関数へ）。すべて role=admin の JWT オーソライザーの確認（NFR4.13） | 既存の HTTP API に道を足すだけ |

## 3. Shared Infrastructure

U1〜U3 の表のとおり。U4 が新しく足す `AdminCounter`・`AuditEntries` は `MonsterNote-Data-dev` の中に収まり、`audit-log` 関数は `MonsterNote-Api-dev` の中に収まる。新しいスタックは作らない。

## 4. 新しいリソースの費用の見込み（project.md の Mandated）

| リソース | 使う量の見込み | 無料枠 | 月額の見込み |
|---|---|---|---|
| DynamoDB（`AdminCounter`・`AuditEntries`） | 月 300 件程度の書き込み（AuditEntries）、月数回（AdminCounter） | 25 GB（常に無料） | 0 円 |
| Lambda（`audit-log` 新規、既存 4 関数拡張） | 月数百回の呼び出し | 月 100 万回（常に無料） | 0 円 |
| **U4 の追加分の合計** | | | **0 円** |

## Assumptions & Open Questions

- `catalog`・`duplicate-detection` 関数の時間切れの引き上げ（8 秒 → 15 秒、10 秒 → 15 秒）は、U4 の nfr-design/performance-design.md が明記した `review`・`reporting`・`duplicate-detection` の 3 関数に加え、削除の順番①を担当する `catalog` 関数にも同じ考え方（削除のバッチ処理に必要な余裕）を適用したもの。`catalog` 関数の既存のルート（一覧・絞り込み、最悪約 3 秒。U3 の performance-design）は 15 秒より十分短く、影響はない。 [assumption]
