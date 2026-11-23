## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T10:12:49Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-specification.md > 1 Deployment > スタック（Q2）の依存の段落 | 4 つのスタックの依存が循環している。(a) 写真の S3 の CORS は 2 つの CloudFront の URL を許すので、Data は Web に依存する。一方、Web は Data に依存すると書かれている。(b) Api の CORS は Web の URL を使うので、Api は Web に依存する。一方、画面の CSP（security-design の connect-src と img-src）は API の URL と写真の S3 の URL を入れるので、Web は Api と Data に依存する。(c) 画面のビルドは API の URL と Cognito の ID が要るのに、cicd-pipeline.md の段階 5 は、画面は Web のスタックで配置し、Web を先に作る前提になっている。「Web を先に作り URL を Api に渡す」だけでは、CDK の合成（cdk synth）が循環参照で失敗する。 | 循環を断つ設計を決めて書く。例: 画面の設定（API の URL、Cognito の ID）は配置時に作る config.json から実行時に読ませる。CSP と CORS の許可は CloudFront のドメインを後から渡す（SSM パラメータやスタックの順序で一方向にする）。Data の CORS は Web に依存させない。スタックごとの依存を、向きが 1 方向の図か表にする。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/cicd-pipeline.md > 2 段階と通過の条件 > 5 デプロイ | cdk deploy の前提となる CDK のブートストラップ（CDKToolkit のスタック、アセット用の S3、IAM ロール）が一切出てこない。mononoke と共有の同じアカウント・リージョンには既存のブートストラップがあるかもしれず、なければ新しいリソースを作る。どちらでも「mononoke に触れない」「新しいリソースの費用と無料枠の確認」「デプロイ前の人の承認」の対象になるが、費用の表（infrastructure-specification の 4）にも手順にもない。 | ブートストラップの有無の確認手順（読み取りだけ）を段階 4 の前に足す。既存を使うか、新しく作るか（作る場合は承認、タグ、費用）を決めて書き、費用の表に載せる。mononoke のブートストラップを変更しないことを明記する。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/cicd-pipeline.md > 2 段階と通過の条件 > 6 スモーク | スモークは「画面が開く・ログイン・GET /v1/catalog/my-reports が 200」だけ。U1 は歩く骨格（walking skeleton）で、このデプロイの確認は本物の流れ（写真の署名付き POST で S3 へ直接送る → 報告の送信 → EventBridge → ReportCatalog の一覧に出る）を確かめる必要がある。今回の設計で一番新しい決定（Q1 の署名付き POST、uploadFields、S3 の CORS が POST を許す）と、EventBridge のルール・IAM の配線は、本物の AWS では一度も確かめられない。CI は AWS なしで、モックの E2E だけである。 | スモークに、署名付き POST での写真のアップロード（ブラウザ相当の CORS 付き）、報告の送信、一覧への反映（EventBridge 経由）までを足す。または別の、デプロイ後の E2E の確認を U1 の通過の条件にする。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-specification.md > 1 Deployment > Tagging | 「アプリ全体に `Name=masahiro-<aws-service>-monsternote`」とあるが、CDK のアプリ全体のタグは 1 つの値しか付けられず、サービスごとに変わる Name にならない。 | リソースの種類ごとに Name を付ける方法（Aspect など）を書くか、Name のサービス名の部分を決めた表を足す。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/cicd-pipeline.md > 3 戻し方 | 初回の v0.1.0 は戻す先のタグがない。失敗したときは cdk destroy になりうるが、承認の手順がない。RETAIN の資源が残ったまま作り直すと、物理名の衝突も起きうる（表の名前を固定するかどうか未記載）。 | 初回のデプロイが失敗したときの扱い（承認つきの削除と、RETAIN 資源の再利用の方針）を書く。表の名前の付け方を決める。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/monitoring-design.md > Alerts | SNS のメール購読は、受信者の確認（Confirm）をしないと有効にならない。この手順がない。「5xx の割合かつ Count ≥ 5」は 1 つのアラームでは、メトリクスの計算式（metric math）が要る。データがないときの扱い（treatMissingData）も未記載。 | 購読の確認を段階 5・6 の手順に足す。アラームの式と欠損データの扱いを書く。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/security-design.md > 4 CORS | 写真の S3 の CORS が「PUT と GET」のまま。Q1 の決定（POST）と食い違っている。 | NFR Design 側の記述を POST・GET に直す。Code Generation で infrastructure-specification を正とすることを明記する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (この段階には検証ツールの指定なし) | 実行せず | 4 つのスタックの依存は、spec・security-design・cicd の記述を相互に突き合わせて確認した。循環は文章上で成立する。 |

### Summary

構成の費用・無料枠・秘密情報の扱いは project.md に沿っているが、4 つのスタックの依存が循環していて、このままでは CDK で作れない（Critical）。ほかに、共有アカウントでのブートストラップの扱いの欠落と、スモークが骨格の本物の流れを確かめない点が Major。
