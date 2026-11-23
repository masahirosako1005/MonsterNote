## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T10:14:56Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-specification.md > 1 Deployment > スタック（Q2）の依存の段落 | 4 つのスタックの依存が循環している。(a) 写真の S3 の CORS は 2 つの CloudFront の URL を許すので、Data は Web に依存する。一方、Web は Data に依存すると書かれている。(b) Api の CORS は Web の URL を使うので、Api は Web に依存する。一方、画面の CSP（security-design の connect-src と img-src）は API の URL と写真の S3 の URL を入れるので、Web は Api と Data に依存する。(c) 画面のビルドは API の URL と Cognito の ID が要るのに、cicd-pipeline.md の段階 5 は、画面は Web のスタックで配置し、Web を先に作る前提になっている。「Web を先に作り URL を Api に渡す」だけでは、CDK の合成（cdk synth）が循環参照で失敗する。 | 循環を断つ設計を決めて書く。例: 画面の設定（API の URL、Cognito の ID）は配置時に作る config.json から実行時に読ませる。CSP と CORS の許可は CloudFront のドメインを後から渡す（SSM パラメータやスタックの順序で一方向にする）。Data の CORS は Web に依存させない。スタックごとの依存を、向きが 1 方向の図か表にする。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/cicd-pipeline.md > 2 段階と通過の条件 > 5 デプロイ | cdk deploy の前提となる CDK のブートストラップ（CDKToolkit のスタック、アセット用の S3、IAM ロール）が一切出てこない。mononoke と共有の同じアカウント・リージョンには既存のブートストラップがあるかもしれず、なければ新しいリソースを作る。どちらでも「mononoke に触れない」「新しいリソースの費用と無料枠の確認」「デプロイ前の人の承認」の対象になるが、費用の表（infrastructure-specification の 4）にも手順にもない。 | ブートストラップの有無の確認手順（読み取りだけ）を段階 4 の前に足す。既存を使うか、新しく作るか（作る場合は承認、タグ、費用）を決めて書き、費用の表に載せる。mononoke のブートストラップを変更しないことを明記する。 | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/cicd-pipeline.md > 2 段階と通過の条件 > 6 スモーク | スモークは「画面が開く・ログイン・GET /v1/catalog/my-reports が 200」だけ。U1 は歩く骨格（walking skeleton）で、このデプロイの確認は本物の流れ（写真の署名付き POST で S3 へ直接送る → 報告の送信 → EventBridge → ReportCatalog の一覧に出る）を確かめる必要がある。今回の設計で一番新しい決定（Q1 の署名付き POST、uploadFields、S3 の CORS が POST を許す）と、EventBridge のルール・IAM の配線は、本物の AWS では一度も確かめられない。CI は AWS なしで、モックの E2E だけである。 | スモークに、署名付き POST での写真のアップロード（ブラウザ相当の CORS 付き）、報告の送信、一覧への反映（EventBridge 経由）までを足す。または別の、デプロイ後の E2E の確認を U1 の通過の条件にする。 | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-specification.md > 1 Deployment > Tagging | 「アプリ全体に `Name=masahiro-<aws-service>-monsternote`」とあるが、CDK のアプリ全体のタグは 1 つの値しか付けられず、サービスごとに変わる Name にならない。 | リソースの種類ごとに Name を付ける方法（Aspect など）を書くか、Name のサービス名の部分を決めた表を足す。 | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/cicd-pipeline.md > 3 戻し方 | 初回の v0.1.0 は戻す先のタグがない。失敗したときは cdk destroy になりうるが、承認の手順がない。RETAIN の資源が残ったまま作り直すと、物理名の衝突も起きうる（表の名前を固定するかどうか未記載）。 | 初回のデプロイが失敗したときの扱い（承認つきの削除と、RETAIN 資源の再利用の方針）を書く。表の名前の付け方を決める。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/monitoring-design.md > Alerts | SNS のメール購読は、受信者の確認（Confirm）をしないと有効にならない。この手順がない。「5xx の割合かつ Count ≥ 5」は 1 つのアラームでは、メトリクスの計算式（metric math）が要る。データがないときの扱い（treatMissingData）も未記載。 | 購読の確認を段階 5・6 の手順に足す。アラームの式と欠損データの扱いを書く。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 4 CORS | 写真の S3 の CORS が「PUT と GET」のまま。Q1 の決定（POST）と食い違っている。 | NFR Design 側の記述を POST・GET に直す。Code Generation で infrastructure-specification を正とすることを明記する。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-specification.md > 1. Deployment の IaC 行 | 「4 つのスタック」と書かれているが、下の表は 5 つで、infrastructure-design-questions.md の Q2 も 4 つのままである。 | 「5 つ」に直し、Q2 から 4 つ案を 5 つに拡張したことを注記する。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-specification.md > スタック表の Web 行 | Web は「作り直してよい」とあるが、Data の CORS と Api が Web の CloudFront の URL を参照している。参照が残る間は Web を削除や置換できず、置換すれば URL が変わる。 | 「Data と Api の更新を先に行う場合に限る」と条件を書く。または Web も RETAIN 扱いにする。 | New |
| R-10 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/monitoring-design.md > Alerts の lambda-errors 行 | 全関数の Errors の合計は 7 関数分のメトリクス計算式が要る。また BucketDeployment が作る CDK 管理の関数は、関数数や無料枠の見込みに含まれていない。 | 計算式の対象を明記し、CDK 管理の関数を費用表と関数数の注記に加える。 | New |

> R-01 Reviewer note: スタックを 5 つに分け、依存は Auth → Web → Data → Api → WebContent の一方向になった。画面のビルドに URL を埋め込まず実行時の `config.json` を読む形にし、CSP は地域のワイルドカードで指定したため、循環は解消された。

> R-02 Reviewer note: 専用の qualifier `mnote` とスタック名 `MonsterNote-CDKToolkit` で bootstrap し、既定の `CDKToolkit` には触れない。承認の段階（段階 0）と費用（0 円）も記載された。

> R-03 Reviewer note: スモークが署名付き POST の写真送信、報告の送信、EventBridge 経由の一覧反映（10 秒以内）、承認、ハンター側の「承認」反映まで通しで確かめる形になった。

> R-04 Reviewer note: Aspect でリソースの種類ごとに Name を付け、構成の試験で Name の有無を確かめる方針になった。

> R-05 Reviewer note: 最初のデプロイには戻す先がないこと、RETAIN の作り直しと物理名の扱いが 3 章に書かれた。

> R-06 Reviewer note: SNS 購読の確認手順、5xx 率のメトリクス計算式、`treatMissingData: notBreaching` が書かれた。

> R-07 Reviewer note: infrastructure-specification の 1 章で、写真の S3 の CORS は Q1 により POST と GET と読み替えると明記された。上流の差し替えとして許容できる。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の構文確認 | PASS | JSON として読める。 |
| スタック依存の手作業の追跡 | PASS | Auth → Web → Data → Api → WebContent で、循環はない。 |

### Summary

前回の Critical と Major はすべて解消した。残りは記述の不整合や注記の不足で、実装を妨げない Minor 3 件である。
