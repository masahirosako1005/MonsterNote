# Code Summary（作ったものの要約）— U3 `u3-review-list`

入力: code-generation-plan.md（承認済み、21 ステップ）、unit-test-instructions.md、Testing Contract（TDD、`sha256:d7b37dee…0325`）、functional-design・nfr-design・infrastructure-design の各文書、U1 のコード（パターンとして踏襲）。

## 1. 作ったもの（ファイル）

一覧は `source-manifest.json` にある。U1 で作った既存のファイルを拡張した箇所と、新規に作った箇所がある。

| 場所 | 中身 |
|---|---|
| `backend/src/review/` | `repository.ts`（拡張。`decide`〈承認・却下を1つの条件付き書き換えに統合〉・`undo`〈`ReturnValues: ALL_OLD` で戻す〉）、`decision.ts`（拡張。却下〈decision=rejected〉・undoUntil の付与）、`get-review.ts`（拡張。reason・reasonText・undoUntil を返す）、`undo.ts`（新規。`POST /v1/reviews/{reportId}/decision/undo`）、`decided-by-name.ts`（新規。BR3.12）、`validate-reject.ts`（新規。BR3.8）、`undo-visibility.ts`（新規。BR3.15） |
| `backend/src/catalog/` | `repository.ts`（拡張。`location`・`lastDuplicateEventAt`・`applyDuplicate`）、`list.ts`（拡張。絞り込み・読む上限2,000件・日数の計算を統合）、`filter.ts`（新規。BR4.5）、`days-elapsed.ts`（新規。BR4.9）、`on-duplicate.ts`（新規。BR4.6・UC19。duplicate.suspected の受け手） |
| `backend/src/handlers/` | `review.ts`（拡張。undo の道を追加）、`consumers.ts`（拡張。`catalog-on-status` 関数が review.status-changed と duplicate.suspected の両方を振り分ける） |
| `backend/src/shared/` | `events.ts`（拡張。`ReviewStatusChangedData` に `reason`・`undone` を追加）、`days.ts`（新規。日数計算の共通関数） |
| `backend/test/integration/` | `u3-review-flow.u3.test.ts`（新規。DynamoDB Local での却下→取り消し→もう一度確認、同時操作、期限切れ、重複の疑いの流れ） |
| `infra/lib/` | `api-stack.ts`（拡張。undo の道、`DuplicateSuspectedRule`〈既存の `catalogOnStatus` 関数を再利用。新しい Lambda 関数は作らない〉） |
| `infra/test/` | `stacks.u3.test.ts`（新規）、`stacks.u1.test.ts`（拡張。道の数・EventBridge の Permission 数の更新） |
| `frontend/ui-kit/src/` | `labels.ts`（拡張。却下理由・絞り込みのラベル）、`theme.ts`（拡張。`MuiToggleButton` の寸法）、`components/DecisionBar.tsx`（拡張。却下ボタン）、`components/ReportDetail.tsx`（拡張。却下理由・撮り直しボタン）、`components/ReportList.tsx`（拡張。重複・手入力の印、日数、緯度経度、ListPager の利用）、`components/UndoButton.tsx`（新規）、`components/RejectReasonForm.tsx`（新規）、`components/FilterBar.tsx`（新規）、`components/ListPager.tsx`（新規）、`components/WaitingDays.tsx`（新規） |
| `frontend/requester/src/` | `api.ts`（拡張。`reject`・`undoDecision`・絞り込みの query）、`pages/DetailPage.tsx`（拡張。却下・取り消しの配線）、`pages/ListPage.tsx`（拡張。FilterBar の配線） |
| `frontend/hunter/src/` | `pages/HomePage.tsx`（拡張。`WaitingDays` の message 表示。AC5.3.2） |
| `contracts/` | `openapi.yaml`（D-1〜D-6＋日数の2項目を反映） |

## 2. 主な判断

- **承認・却下の統合**: `repository.ts` の `approve` を `decide` に一般化し、承認・却下を同じ `ConditionExpression`（`status = :checking`）の条件付き書き換えで扱う（reliability-design.md §1）。`reason`・`reasonText` は却下のときだけ SET する（entities.md の「status=checking のとき空」という制約、および approved では reason を持たせない設計に忠実）。
- **取り消しの `ReturnValues: ALL_OLD`**: `undo` は事前の読み出しをせず、条件付き `UpdateCommand` の `ReturnValues: ALL_OLD` で書き換え前の記録（`previousStatus` の計算に必要）を得る。BR3.9 の「読んで判断するのではなく条件にした1回の書き換え」という設計意図に最も忠実な実装。
- **取り消しの通知は1回だけ試し、結果を待たない**: `undo.ts` の `publishUndone` は `publishEvent` を `delaysMs: []` で呼び、`await` せず応答を返す（reliability-design.md §2・performance-design.md §1。NFR2.14 の2秒予算）。送信の成否はログと `markEventSent` の有無だけに残る（受け入れたリスク）。
- **`duplicate.suspected` の受け手は新しい Lambda 関数を作らない**: infrastructure-specification.md の「新しい関数を作らない」という明記と、logical-components.md の構成図（`EB --> FC`。ReportCatalog が受ける）を踏まえ、既存の `catalogOnStatus` 関数を再利用した。`handlers/consumers.ts` の中で `envelope.type` を見て `review.status-changed` と `duplicate.suspected` を振り分ける。infra 側は `DuplicateSuspectedRule`（新しいルール。関数は増やさない）を1つ追加しただけ。この判断は infrastructure-specification.md・logical-components.md が明示的にこのイベントの配線（EventBridge Rule）を書き漏らしていたための補完であり、「新しい Lambda 関数・新しい表・新しい外部サービスを作らない」という同文書の制約自体は守っている。
- **絞り込み一覧の読み出し**: フィルタなしのときは U1 と同じ1回のクエリ＋`Select: COUNT`（既存のテストを壊さない）。フィルタがあるときだけ、100件ずつ読み進めて `matchesFilter` で除外する2本のスキャン（ページ用・全件数用）に切り替える。両方とも読む上限2,000件で打ち切り、`totalCountHasMore` を返す（BR4.7・BR4.8・D-1）。読み出し中の失敗（`repo.listPage` の例外）もそこまでの結果で打ち切る（performance-design.md §2 Q2-A）。
- **日数の計算を一覧の応答に含めた**: functional-spec.md UC18 の手順5が `GET /v1/catalog/reports` 自身の処理として日数の計算を書いていたため、`daysSinceSubmitted`・`waitingOverSevenDays` を一覧の行に追加した（D-1〜D-6 に明記はないが、UC18 の記述と整合させるための実装上の判断。openapi.yaml に追記し、コメントで理由を記録した）。
- **`decidedByName` の読み出し時の置き換え**: D-4 のとおり、書き込み時に加えて読み出し時にも UUID の形を検出して「依頼元の担当者」に置き換える（`decided-by-name.ts`）。U1 がすでに `dev` に保存した記録のデータを作り直す必要はない。
- **却下・取り消しのログに理由の文・表示名を出さない**: `shared/logger.ts` の `ALLOWED_LOG_FIELDS`（allowlist）を変更していないため、`reasonText`・`decidedByName` はもともと出力されない（NFR5.14）。この allowlist 方式自体が U1 からの既存の防御であり、U3 で壊していないことをテストで確認した。

## 3. 試験の結果

`aidlc engine swarm check u3-review-list` が `converged:true` を報告（`npm run verify` 一式: format:check → lint → typecheck → test:coverage → test:e2e → synth、すべて成功）。

| 種類 | 件数 | 結果 |
|---|---|---|
| backend（review・catalog・handlers・shared、既存+新規） | 約170件 | すべて成功 |
| backend 結合試験（DynamoDB Local、skeleton-flow + u3-review-flow） | 8件 | すべて成功 |
| frontend（ui-kit の部品・画面の流れ） | 約80件 | すべて成功 |
| CDK の構成の試験（stacks.u1 + stacks.u3） | 55件 | すべて成功 |
| 全体のテスト数 | 320件 | すべて成功 |
| 行カバレッジ | 93.43%（80%の床を満たす） | — |
| E2E（Playwright、chromium + mobile-webkit） | 12件 | すべて成功（U1 のスケルトンの E2E。U3 固有の E2E は計画になく、追加していない） |
| `cdk synth` | — | 成功（5スタック） |

テストを書いたが個別には「失敗させてから直す」の確認を省略したもの: なし（すべて Red → Green の順で進めた。審査ログは各テストの実装直前のコミット差分に相当するが、本ワークツリーでは単一コミット単位の履歴は持たないため、進め方の記録はこの文書と各テストファイルの意図コメントに残す）。

## 4. この Unit で見つけ、直した不具合

- **DynamoDB の予約語 `location`**: `catalog/repository.ts` の `applySaved` に `location` 属性を素の名前で `UpdateExpression` に書いたところ、結合試験（DynamoDB Local）で `ValidationException: location is a reserved keyword` が発生した。`#location` の `ExpressionAttributeNames` に直した（モックだけの単体試験では検出できず、結合試験で見つかった）。
- **絞り込みのトグルボタンの寸法**: `FilterBar` の `ToggleButton` に `sx={{ minHeight: 44 }}` を直書きしていたが、frontend-components.md の「64px以上（U1のUiKitのまま）」という指示、および `theme.ts` の「画面ごとに上書きしない」という方針に反していた（`MuiButton` の上書きは `ToggleButton` には効かない）。`theme.ts` に `MuiToggleButton` の `styleOverrides` を追加し（ハンター64px・職員48px）、個別の `sx` を削除した。`theme.u1.test.ts` にこの寸法の確認を追加した。
- **`ListPage.u3.test.tsx` の試験自身のタイミングの誤り**: 一覧全体を `npx vitest run`（フル並列）で実行すると、「読む上限に達したときは...」の1件がまれに（だが特定の負荷状況では高い確率で）失敗することがあった。最初は全体のワーカー並列（45ファイル同時）によるリソース競合を疑い `vitest.config.ts` に `fileParallelism: false` を試したが、発生確率が下がるだけで根絶しなかったため、さらに調べた。原因は試験コード自身にあった: 同じファイルの他のテストは `await login()` のあとに `await screen.findAllByTestId('report-row')`（非同期に待つクエリ）を挟んでからボタンを操作していたのに対し、この1件だけログイン直後に同期の `screen.getByTestId('filter-status-approved')` でボタンを探していたため、ログイン後の画面遷移・初回の一覧読み出しが終わる前に探してしまう競合状態（race condition）だった。`await screen.findByTestId(...)` に直し、実行順序に依存しない形にしたところ、フル並列（既定の `vitest run`）で 6 回連続成功を確認した。`vitest.config.ts` の変更は不要と判断し、元に戻した。

## 5. 承認済み計画からの逸脱・補足

- **ハンターの却下理由の画面（H9）は作っていない**: frontend-components.md・functional-spec.md（UC20・US5.2・AC5.2.1〜AC5.2.3）はハンターが却下の理由を見て「撮り直して新しく報告する」へ進む画面を求めているが、承認済み計画の §7（フロントエンドの振る舞い層）が名指すファイルは `DetailPage.u3.test.tsx`・`UndoButton.u3.test.tsx`・`ListPage.u3.test.tsx`（すべて依頼元側）のみで、ハンター側のページは含まれていなかった。バックエンド（`GET /v1/reviews/{reportId}` が却下の理由をハンターにも返す。BR3.14）と、共有コンポーネント `ReportDetail`（`reason`・`reasonText`・`onRetry` プロパティ）は用意したが、これを使うハンター用のページ・ルートは追加していない。traceability.json で AC5.2.1〜AC5.2.3 を `Deferred` とした。次の Unit またはフォローアップでハンターの報告詳細ページ（H9）を追加すれば、すでにある部品とAPIでそのまま実装できる。
- **`duplicate.suspected` の EventBridge 配線**: §3「見つけた不具合」と重複するが、設計文書が「新しい関数を作らない」制約の具体の配線手段（どの関数が受けるか）を明記していなかったため、developer の判断で補った（詳細は上記「主な判断」）。
## 6. トレーサビリティ

`traceability.json` に 77 件（AC・NFR・BR）の対応を記録。74件 OK、3件（AC5.2.1〜AC5.2.3）Deferred（上記 §5）。
