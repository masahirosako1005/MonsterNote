# Infrastructure Specification（AWS の構成）— U3 `u3-review-list`

入力: `construction/u3-review-list/nfr-design/`（logical-components、performance・security・scalability・reliability・observability-design）、`construction/u3-review-list/functional-design/functional-spec.md`（UC15〜UC20）、`inception/domain-design/components.md`、`construction/u1-skeleton/infrastructure-design/infrastructure-specification.md`（U1 の構成。ここに足す）、infrastructure-design-questions.md（Q1-A）。

U3 は、U1 の 5 つのスタックをそのまま使い、新しいスタック・新しい表・新しい関数・新しい外部サービスを作らない（Q1-A）。`MonsterNote-Api-dev` の既存の `review`・`catalog` の 2 つの関数に API の道を足し、`MonsterNote-Data-dev` の既存の表に項目を足すだけ（§2 の Notes のとおり、`review`・`catalog` は U1 からすでに別々の関数であり、nfr-design の「すでに1つの関数にまとまっている」という前提の記述をこの段階で訂正した）。

## 1. Deployment（U1 からの差分）

| Facet | Choice | Rationale |
|---|---|---|
| Resource sizing | Review 関数のメモリ・時間切れは変えない（128 MB、時間切れ 8 秒。U1 のまま） | performance-design.md 全体で既存の時間切れの中に収まる見込み |

変更はこの 1 行のみ（変更なしの確認）。ほかの Facet（Compute model・Networking・Storage・Environments・IaC・Tagging・bootstrap）は U1 のまま。

## 2. Infrastructure Services（U3 で足すもの）

| Service | Role | Configuration | Notes |
|---|---|---|---|
| DynamoDB `ReviewDecisions`（既存。項目を追加） | データ | 既存のキー（`reportId`）のまま。項目を追加: `reason`・`reasonText`・`undoUntil`（entities.md のとおり、U1 では空のまま持っていた項目を本番にする）。**新しい索引は作らない** | Review の関数だけ |
| DynamoDB `ReportListItems`（既存。項目を追加） | データ | 既存のキー・索引（全件用、ハンター用）のまま。項目を追加: `duplicateSuspected`・`manualEntry`。**絞り込み用の新しい索引は作らない**（BR4.7。新しい順の既存索引を読んでからアプリ側で条件に合わない行を除く） | ReportCatalog の関数だけ |
| Lambda `review`（既存。更新） | 処理 | メモリ・時間切れは変えない（128 MB、8 秒）。却下（`PUT /v1/reviews/{reportId}/decision`）・取り消し（`POST /v1/reviews/{reportId}/decision/undo`）・状態の読み出し（`GET /v1/reviews/{reportId}`）をこの関数に足す。IAM 権限は既存の `ReviewDecisions` への読み書きのまま（`ReportListItems` へのアクセスは持たせない） | **U1 の構成の訂正**: U3 の nfr-design（logical-components.md Q1）は「Review と ReportCatalog はすでに同じ関数にまとまっている」という前提で書かれていたが、U1 の infrastructure-specification.md を確認すると、実際には `review` 関数と `catalog` 関数は**別々**（それぞれ自分の表だけの IAM 権限を持つ）。この Infrastructure Design では、nfr-design の実際のねらい（U3 のために新しい関数を増やさない）を、U1 の正しい関数境界に沿って実現する: 承認・却下・取り消し・状態読み出しは引き続き `review` 関数、一覧・絞り込みは既存の `catalog` 関数に置く（下の行）。表に対する IAM の境界（部品ごとに自分の表だけ）は崩さない |
| Lambda `catalog`（既存。更新） | 処理 | メモリ・時間切れは変えない（U1 の既定のまま）。絞り込み一覧（`GET /v1/catalog/reports`）・ハンターの一覧（`GET /v1/catalog/my-reports`）の処理をこの関数に足す。IAM 権限は既存の `ReportListItems` への読み書きのまま、新しい権限は不要（もとから自分の表を読める） | 一覧・絞り込みの処理は、U1 からすでにこの関数が担っている領域の拡張であり、新しい関数も新しい権限も不要 |
| API Gateway HTTP API（既存。道を追加・拡張） | 入口 | `PUT /v1/reviews/{reportId}/decision`（既存の道。`decision=rejected` を受け付けるよう拡張。担当: `review`）、`POST /v1/reviews/{reportId}/decision/undo`（新しい道。担当: `review`）、`GET /v1/reviews/{reportId}`（既存の道。応答に `undoUntil` を条件付きで含めるよう拡張。担当: `review`）、`GET /v1/catalog/reports`（既存の道。`status`・`flag`・`cursor` のクエリパラメータに対応するよう拡張。担当: `catalog`）、`GET /v1/catalog/my-reports`（既存の道。D-2 により応答の行に緯度・経度を足す。担当: `catalog`） | 既存の HTTP API・JWT オーソライザーの構成は変えない |

## 3. Shared Infrastructure

U1 の「Shared Infrastructure」の表のとおり。U3 は `MonsterNote-Data-dev`・`MonsterNote-Api-dev` の既存の表・関数を拡張するだけで、新しい共有リソースは生まれない。

## 4. 新しいリソースの費用の見込み（project.md の Mandated）

| リソース | 使う量の見込み | 無料枠 | 月額の見込み |
|---|---|---|---|
| DynamoDB（既存の表への項目追加） | 既存の読み書き回数からの増加はごくわずか（却下・取り消し・絞り込みの操作は月数十回規模） | 25 GB（常に無料） | 0 円 |
| **U3 の追加分の合計** | | | **0 円** |

新しい AWS リソースは作らないため、費用の増加はない。

## 5. 約束（contract-summary）の変更

functional-spec.md の D-1〜D-6（§7「約束との違い」）のとおり。Code Generation で `contracts/openapi.yaml`・`asyncapi.yaml` に反映する:

| # | 対象 | 変更 |
|---|---|---|
| D-1 | `GET /v1/catalog/reports` の応答 | 全件数に「これ以上ある」の印を足す |
| D-2 | `GET /v1/catalog/reports`・`my-reports` の行 | 緯度・経度を足す |
| D-3 | `PUT /v1/reviews/{reportId}/decision` | `reasonText` の長さ（1〜200 文字）を仕様に明記 |
| D-4 | 読み出しの `decidedByName` | 利用者の ID の形を「依頼元の担当者」に置き換える仕様を明記 |
| D-5 | `GET /v1/reviews/{reportId}` の応答 | `undoUntil` を足す（本人かつ期限内のときだけ） |
| D-6 | `POST /v1/reviews/{reportId}/decision/undo` の応答 | `409 ALREADY_UNDONE` を足す |

## Assumptions & Open Questions

特になし。U3 は新しいインフラの決定を要しない Unit（Q1-A）。
