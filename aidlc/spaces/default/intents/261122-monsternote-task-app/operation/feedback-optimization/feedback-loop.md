# Feedback Loop — Feedback & Optimization

本書は、次のIdeation/Inceptionサイクルに持ち越すべき項目をまとめる。**ここに挙げるのは、このプロジェクトの中ですでに決定・記録済みの先送り・保留事項の一覧であり、本ステージで新たに思いついた機能案ではない**（`cross-unit-traceability.md`・各ステージのAssumptions & Open Questions・人の判断の記録を出典とする）。

## 1. 次のIdeation/Inceptionで検討する機能候補（既存の優先度どおり未着手）

| 項目 | 出典 | 優先度・理由 |
|---|---|---|
| ハンター向けの却下理由の画面（H9。却下の理由を見て、撮り直して新しく報告する） | U3 code-summary.md §5。`AC5.2.1〜5.2.3`はtraceability.jsonで`Deferred`と記録済み | バックエンド（却下理由を返す）と共有部品（`ReportDetail`）はすでに用意済み。画面・ルートを足すだけで着手できる |
| 重複の疑い「写真」での検出（FR11.1） | inception時点で「Mustの要件がすべて終わったあとに作る」と明記。U2 asyncapi.yamlのコメントでも確認済み | 意図した低優先度。Must要件が一巡した今、着手を検討する時期に来ている |
| 重複の疑い「月の輪」での検出（FR12.1） | inception時点で「実現性が低いため間に合わなければ次の版に回す」と明記 | 実現性検証（フィージビリティ）からやり直す必要がある任意要件 |
| 「知らせのないまま残った報告」の再送を管理者画面の機能にする | `incident-response/incident-response-questions.md` Q2。今回は手順書（手作業）のままにする判断（519ee1b2） | 発生頻度が低い見込みのため今回は見送ったが、運用が続き発生頻度が上がれば画面化を検討 |
| requestIdをLambda間の直接呼び出し・EventBridgeのイベントに伝播させる | `observability-setup/tracing-config.md`。U1から存在した設計上の制約で、今回初めて文書化 | アプリケーションコードの変更が要る。現状`reportId`のみが相関キーで、業務に無関係な技術的な呼び出し（`internal-invoke.ts`等）の追跡がしづらい |

## 2. 次のOperationサイクル（Feedback & Optimizationの次回実行）で確認すること

機能追加ではなく、時間が経てば自然に確認可能になる項目:

| 項目 | 出典 | いつ確認できるか |
|---|---|---|
| API全体の成功率（NFR10.1。99%／30日のローリング） | `slo-report.md` §2 | 実機デプロイから30日分のデータが蓄積してから |
| コールドスタート時の応答時間（NFR2.5） | `performance-validation/nfr-validation-matrix.md` §5 | 運用の中で自然に発生するコールドスタートを`dashboards.md`のウィジェットで継続観察 |
| 絞り込み一覧（`GET /v1/catalog/reports`）が2,000件の上限に近づいていないか（NFR2.12） | `performance-validation/nfr-validation-matrix.md` §4 | 実際の報告件数が増えてきたら再計測 |
| DynamoDBのスロットリング発生の有無 | `observability-setup/alarms.md` §5 | 監視アラームは追加しない判断（f6a5a28c）だが、`dashboards.md`では見える。定期的に見る |

## 3. この会話（AI-DLCセッション）自体から持ち越す教訓

`drift-report.md`で見つけた共通パターン（「ある時点の前提を埋め込んだ成果物が、前提の変化に追従する仕組みが無い」）は、次のUnit追加・次のプロジェクトのConstructionフェーズでも再発しうる。特に:

- 実機確認用スクリプト（`scripts/smoke.ts`・`scripts/perf-check.ts`）は、バックエンドの必須項目やビジネスルール（重複判定の距離しきい値等）が変わるたびに、追従の対象として明示的にチェックリストに含める必要がある。
- CDKでAWSのサービス固有の上限（CloudWatchの指標数上限等）に依存する設計は、`cdk diff`では検出できないため、設計レビューの段階で「この上限は実際にCloudFormationでどう展開されるか」を手を動かして確認する一手間が要る。

これらは`team.md`/`project.md`の`## Corrections`に記録するかどうかを、本ステージの承認ゲートで人に確認する（学習の儀式。stage-protocol-learnings.md）。

## Assumptions & Open Questions

None（本書自体は振り返りの整理であり、新たな人の判断は`feedback-optimization-questions.md`に分けて記載する）。
