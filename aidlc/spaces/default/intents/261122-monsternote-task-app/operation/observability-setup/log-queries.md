# Log Queries — Observability Setup

入力: `construction/u1-skeleton/nfr-design/observability-design.md`（ログの項目・requestId での追跡）、`construction/u2-report-duplicate/nfr-design/observability-design.md`・`construction/u3-review-list/nfr-design/observability-design.md`・`construction/u4-accounts-admin/nfr-design/observability-design.md`（Unit ごとに足したログ項目・クエリ例）、`construction/u2-report-duplicate/infrastructure-design/monitoring-design.md`・`construction/u3-review-list/infrastructure-design/monitoring-design.md`・`construction/u4-accounts-admin/infrastructure-design/monitoring-design.md`（「CDK の `QueryDefinition` として保存する」という決定）、`infra/lib/api-stack.ts`（実際のアクセスログの項目・ロググループ構成）、`backend/src/shared/logger.ts`（出してよいログ項目の allowlist）。

U1〜U4 の Infrastructure Design は、クエリを「CDK の `QueryDefinition` としてコンソールに保存する」と繰り返し決めていたが、`infra/lib/`（`api-stack.ts`・`data-stack.ts`・その他）のどのファイルにも `QueryDefinition` の実装は無い（確認済み。コードを読んだ事実であり、推測ではない）。つまり**この決定はまだ実装されていない**。本ステージでは、まず保存すべきクエリの内容を確定し、実装（CDK への `QueryDefinition` 追加）は Code Generation 相当の変更として別途行う前提で一覧化する。

## 1. requestId による原因追跡（U1。すべての API 呼び出しに共通）

画面に表示する「問い合わせ番号」は、API Gateway の `requestId`（`backend/src/shared/http.ts` の `requestIdOf`、レスポンスヘッダー `x-request-id`）をそのまま使う。関数のロググループ（`/aws/lambda/<関数>Function...`）を対象に、次のクエリで追跡する。

```
fields @timestamp, function, level, message, route, status, durationMs, errorCode, accountId
| filter requestId = "<問い合わせ番号>"
| sort @timestamp asc
```

**制約（本ステージで確認した事実。`tracing-config.md` で詳述）**: この `requestId` は、API Gateway 経由で呼ばれた関数自身のログにしか現れない。`Reporting → Accounts`・`Reporting → Settings`・`Reporting → DuplicateDetection`・`DuplicateDetection → Settings` などの部品間の直接呼び出し（Lambda `InvokeCommand`）には `requestId` が転送されておらず（`backend/src/shared/internal-invoke.ts` の `invokeInternal` のペイロードに requestId は含まれない）、呼ばれた側の関数のログを同じ `requestId` で追跡することはできない。呼ばれた側は `reportId`・`accountId` など業務上の ID で手がかりを探す必要がある。

## 2. U2 で足したクエリ（判別・重複判定）

```
-- 判別の上限超過（errorCode=DETECTION_LIMIT_REACHED）。アカウントごとの件数
fields @timestamp, accountId, callCount
| filter errorCode = "DETECTION_LIMIT_REACHED"
| stats count() by accountId
```

```
-- 判別の失敗率（outcome=undetected の件数 ÷ 全体）
fields @timestamp, outcome
| filter ispresent(outcome)
| stats count() as total, sum(outcome = "undetected") as undetected by bin(1d)
```

```
-- 判別のタイムアウト回数
fields @timestamp, failureReason
| filter failureReason = "timeout"
| stats count() by bin(1d)
```

```
-- 重複判定の読み出し件数の分布と、500件の上限到達回数
fields @timestamp, readCount, limitReached
| filter ispresent(readCount)
| stats avg(readCount) as avgRead, max(readCount) as maxRead, sum(limitReached) as hitLimitCount by bin(1d)
```

```
-- 送信前の重複問い合わせの失敗（errorCode=DUPLICATE_CHECK_FAILED）
fields @timestamp, reportId
| filter errorCode = "DUPLICATE_CHECK_FAILED"
| stats count() by bin(1d)
```

## 3. U3 で足したクエリ（却下・取り消し・同時操作）

```
-- 却下の件数・理由の内訳
fields @timestamp, reportId, reason
| filter ispresent(reason) and @message like /却下|rejected/
| stats count() by reason
```

```
-- 同時の操作で弾かれた回数（409）
fields @timestamp, errorCode, accountId
| filter errorCode = "ALREADY_DECIDED" or errorCode = "ALREADY_UNDONE" or errorCode = "UNDO_EXPIRED"
| stats count() by errorCode
```

```
-- 絞り込みの上限（2,000件）到達回数
fields @timestamp, accountId
| filter errorCode = "FILTER_LIMIT_REACHED"
| stats count() by bin(1d)
```

```
-- 取り消しの知らせの送信失敗（一覧の表示が古いまま残りうる手がかり。reliability-design.md §2 の受け入れたリスク）
fields @timestamp, reportId
| filter errorCode = "EVENT_PUBLISH_FAILED"
| stats count() by bin(1d)
```

## 4. U4 で足したクエリ（アカウント管理・削除・設定）

```
-- アカウントの作成・無効化・有効化・パスワード再設定の件数
fields @timestamp, action, targetAccountId
| filter action like /^account\./
| stats count() by action
```

```
-- 管理者の無効化が拒まれた回数
fields @timestamp, errorCode, accountId
| filter errorCode = "CANNOT_DISABLE_SELF" or errorCode = "LAST_ADMIN"
| stats count() by errorCode
```

```
-- 「すべて削除」の実行回数と部品ごとの結果
fields @timestamp, componentName, deletedCount, durationMs
| filter ispresent(componentName) and @message like /すべて削除|data\.deleted/
| stats sum(deletedCount) as total, max(durationMs) by componentName
```

```
-- 設定の変更の回数
fields @timestamp, accountId
| filter action = "settings.updated"
| stats count() by bin(1d)
```

## 5. 本ステージで新たに用意したクエリ（ルートごとの p95 Latency）

`slo-config.md` §3.2 のとおり、API Gateway のルート単位の Latency は標準メトリクスでは取れないため、アクセスログ（ロググループ: `ApiAccessLogs`。項目: `requestId`・`routeKey`・`status`・`latency`・`integrationError`）を対象に次のクエリを用意する。

```
-- ルートごとの p50/p95/p99 Latency（ミリ秒）。30日分を見るときは時間範囲を30日に広げて実行する
fields @timestamp, routeKey, status, latency
| stats pct(latency, 50) as p50, pct(latency, 95) as p95, pct(latency, 99) as p99, count() as n by routeKey
| sort p95 desc
```

```
-- ルートごとの非2xx応答の件数（4xx/5xxの切り分け）
fields @timestamp, routeKey, status
| filter status >= 400
| stats count() by routeKey, status
```

## 6. ロググループの一覧（保存先）

| 対象 | ロググループの作り方 | 保存期間 |
|---|---|---|
| 各 Lambda 関数（12 個） | `infra/lib/api-stack.ts` の `fn()` ヘルパーが関数ごとに専用の `LogGroup`（論理 ID `<関数名>Logs`）を作り、`NodejsFunction` の `logGroup` に渡す | 14 日（`RetentionDays.TWO_WEEKS`） |
| API Gateway アクセスログ | 論理 ID `ApiAccessLogs`（`infra/lib/api-stack.ts`） | 14 日 |
| 画面デプロイのログ | 論理 ID `DeploymentLogs`（`infra/lib/web-content-stack.ts`） | 14 日 |

**実際のロググループ名の注記**: いずれの `LogGroup` も `logGroupName` を明示していないため、実際の名前は CloudFormation が論理 ID から自動生成する（`/aws/lambda/<関数名>` のような規則正しい名前になる保証はない）。本ステージはこのセッションに AWS 認証情報へのアクセスが無く、実機の正確なロググループ名を確認していない。上の Logs Insights クエリをコンソールやツールで実行する際は、まず `aws logs describe-log-groups`（または CloudWatch コンソールの検索）で各関数に対応する実際のロググループ名を確認してから対象に指定すること。

すべて `RemovalPolicy.DESTROY`（スタックを消せばログも消える。NFR11.1・NFR11.6 の「保存期間 14 日」の要求には影響しない）。

## Assumptions & Open Questions

- 上記のクエリはすべて、各クエリをどのロググループ（または複数のロググループ横断）に対して実行するかを前提にしている。CDK の `QueryDefinition` として実装する際は、`logGroupNames`（または `logGroupNamePrefixes`）を関数ごとに正しく割り当てる必要があり、これは Code Generation 相当の実装作業として別途行う。 [assumption]
- `stats ... by bin(1d)` を使うクエリは、Logs Insights の既定の実行時間範囲（コンソールで都度選ぶ）に依存する。30 日分を見たい場合は人が実行のたびに範囲を指定する（自動実行・自動保存の仕組みは作らない。U1〜U4 の「ダッシュボードは作らない」という方針と同じ理由）。 [assumption]
