# Tracing Config — Observability Setup

入力: `construction/u1-skeleton/nfr-design/observability-design.md`・`construction/u1-skeleton/infrastructure-design/monitoring-design.md`（「追跡は X-Ray を使わず、requestId で CloudWatch Logs Insights から探す」という U1 の決定。U2〜U4 は変更していない）、`construction/u1-skeleton/nfr-design/security-design.md`（NFR5.5: 出してよいログ項目）、`backend/src/shared/logger.ts`（ログの allowlist の実装）、`backend/src/shared/http.ts`・`backend/src/shared/internal-invoke.ts`・`backend/src/shared/events.ts`（requestId・eventId・reportId の実際の流れ）、`infra/lib/api-stack.ts`（Lambda の Tracing 設定の有無）。

## 1. 方針: X-Ray は使わない（全 Unit で一貫）

U1 の observability-design で「X-Ray は使わない」と決め、以後 U2〜U4 も変更していない。実装（`infra/lib/api-stack.ts`）を確認しても、`NodejsFunction` の定義に `tracing: Tracing.ACTIVE` のようなアクティブトレーシングの指定は無く、`aws-lambda` の `Tracing` import 自体が無い。つまりコードもこの方針どおりで、X-Ray は有効化されていない（追加費用も発生しない）。**本ステージはこの方針を変更しない**。

分散トレーシングの代わりに、構造化ログに含まれる識別子（requestId・eventId・reportId など）を手がかりに、CloudWatch Logs Insights で手動に追跡する。本ステージでは、実際にどの識別子がどこまで伝搬しているかをコードを読んで確認し、**設計文書のどこにも明記されていなかった追跡の限界**を明らかにする。

## 2. 識別子の伝搬経路（コードを読んで確認した事実）

このシステムには 3 種類の相関 ID があり、それぞれ届く範囲が異なる。

| 識別子 | 発行元 | 届く範囲 |
|---|---|---|
| `requestId`（API Gateway の `$context.requestId`。画面の「問い合わせ番号」） | API Gateway（`backend/src/shared/http.ts` の `requestIdOf`） | **その HTTP リクエストを直接受けた 1 つの関数のログだけ**。レスポンスヘッダー `x-request-id` として画面にも返る |
| `eventId`（`EventEnvelope.eventId`。送信のたびに `randomUUID()` で新しく発行） | `backend/src/shared/events.ts` | その知らせを送った関数と、受け取った知らせの受け手の関数（`ProcessedEvents` 表の二重処理防止キーとしても使う）。**元の HTTP リクエストの `requestId` とは別の ID**で、両者を突き合わせる仕組みは無い |
| `reportId`（業務上の報告 ID） | `Reporting` 関数が送信時に発行 | `EventEnvelope.data` に乗る業務データとして、送信 → 知らせ → 受け手（Review・ReportCatalog・DuplicateDetection）まで一貫して引き継がれる |

## 3. 確認できた追跡の限界（本ステージで新たに判明した事実。どの Unit の設計文書にも記載が無い）

### 3.1 部品間の直接呼び出し（Lambda InvokeCommand）には `requestId` が伝わらない

`Reporting → Accounts`（C10）・`Reporting → Settings`・`Reporting → DuplicateDetection`（C9）・`DuplicateDetection → Settings`・`review`/`catalog`/`duplicate-detection`/`settings`/`audit-log` → `Accounts`（`mustChangePassword` の確認）という部品間の直接呼び出しはすべて `backend/src/shared/internal-invoke.ts` の `invokeInternal` を通る。このペイロードの型（`TRequest extends object`）には `requestId` を運ぶ専用のフィールドが無く、実際の呼び出し元のコードも `requestId` を乗せていない（確認のため `grep` したが、`backend/src/handlers/` 配下に `requestId` の参照は 1 件も無い。各ハンドラ内で `requestId` を使っている箇所は `accounts/`・`catalog/` など個別の業務コードの中だけで、内部呼び出しのペイロードには渡っていない）。

**実際の影響**: 1 回の「報告を送信する」操作（`POST /v1/reports`）の中で `Reporting` 関数が `Accounts`・`Settings`・`DuplicateDetection` を順に呼び出した場合、`Reporting` 自身のログは `requestId` で追跡できるが、呼ばれた `Accounts`・`Settings`・`DuplicateDetection` 側のログは、同じ `requestId` でフィルタしても出てこない（そもそも記録されていない）。各関数は自分の Lambda 実行環境自身の AWS 内部リクエスト ID（これは API Gateway の `requestId` とは別物）しか持たない。

### 3.2 EventBridge 経由の非同期処理には、元の HTTP リクエストへの相関キーが無い

`report.saved`・`review.status-changed`・`duplicate.suspected`・`audit.recorded` のいずれも、`EventEnvelope.eventId` は送信時に新規発行される UUID であり、元の HTTP リクエストの `requestId` を引き継がない。したがって「この承認操作（1 回の `PUT /v1/reviews/{id}/decision` 呼び出し）がきっかけで動いた `catalog-on-status`・`duplicate-detection-on-status` のログ」を `requestId` で横断検索することはできない。

### 3.3 実務上の回避策（現状で可能な追跡方法）

`EventEnvelope.data` に乗る `reportId`（または `accountId`・`targetId`）は、送信元から受け手まで一貫して引き継がれる。そのため、**`requestId` ではなく `reportId` を軸にしたログ横断検索**が、この構成での実質的な「トレース ID」として機能する。`log-queries.md` のクエリはこの前提で `reportId` を軸に書かれているものが多い（判別・重複判定・削除の実行結果など）。requestId は「1 回の同期呼び出し（API → 1 関数）の中の原因調査」専用、reportId は「1 件の報告が複数の部品・非同期処理をまたいで辿った経路の調査」専用、という 2 段構えで運用する。

## 4. この限界への対処（本ステージの範囲内でできること／できないこと）

- **できること（本ステージの成果物として対処済み）**: 上記の限界を明文化し、`log-queries.md`・`slo-config.md` の設計を「`requestId` は同期呼び出し内、`reportId` は非同期の経路」という前提で統一した。これにより、今後トラブルシューティングする人が「`requestId` で探しても出てこない」という事象に遭遇したときに、原因（設計上そうなっている）をすぐに特定できる。
- **できないこと（Observability Setup の範囲外）**: `invokeInternal` のペイロードや `EventEnvelope` に `requestId` を追加で乗せ、同期・非同期を問わず 1 つの相関 ID で横断追跡できるようにする変更は、アプリケーションコード（`backend/src/shared/`）の変更であり、本ステージ（運用の監視設定）の範囲を超える。実施する場合は Code Generation 相当の変更として別途計画する。

## 5. X-Ray を将来有効化する場合の見積もり（参考。今回は採用しない）

仮に `tracing: Tracing.ACTIVE` を 12 関数すべてに付けた場合、X-Ray は月 10 万トレースまで無料（to 2026-11 時点の一般的な無料枠）だが、トレースの記録自体に Lambda の実行時間がわずかに増える可能性があり、何より「X-Ray を使わない」という全 Unit 一貫した設計判断（費用・複雑さに対する試験運用の規模の見合わなさ）を覆す変更になる。本ステージはこの判断を尊重し、有効化を提案しない。将来、部品間の呼び出しが増えて `requestId`／`reportId` による手動追跡が実務上つらくなった場合に、Feedback & Optimization で再検討する対象とする。

## Assumptions & Open Questions

- `invokeInternal` のペイロードに `requestId` を足して内部呼び出しの追跡を改善することは、各ハンドラの型定義（`TRequest`）を変更する必要があり、影響範囲は `Reporting`・`DuplicateDetection`・`Settings`・`Accounts` など複数の関数にまたがる。実施するかどうかは人の判断が要る。 [assumption]
- 本ステージはコード（`backend/src/handlers/`・`backend/src/shared/`）を `grep`・`Read` で確認したのみで、実際の CloudWatch Logs の中身（実機のログ）までは確認していない（AWS 認証情報へのアクセスが無いセッションのため）。上記の限界は静的なコード読解に基づく結論であり、実機ログでの裏付けは別途行うことを推奨する。 [assumption]
