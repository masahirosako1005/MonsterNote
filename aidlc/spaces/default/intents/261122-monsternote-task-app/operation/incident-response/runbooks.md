# Runbooks — Incident Response

入力: `operation/observability-setup/{alarms,dashboards,log-queries}.md`、`operation/deployment-pipeline/rollback-runbook.md`、`docs/06-operation.md`（実機で実際に起きた2件）、各Unitの`nfr-design/reliability-design.md`（受け入れたリスクの一覧）、`backend/src/accounts/repository.ts`等（DynamoDBの直接操作が必要な場合の表構成）。

本ステージのstage fileは「SSM Automationランブック・AWS Incident Manager・AWS Backup」を例示しているが、このプロジェクトは単一`dev`環境・開発者1人・無料枠のMVPであり、これらの有償/企業向けの仕組みは導入しない（project.mdのForbidden「常時課金リソースを使わない」、team.mdの「本番相当の環境が無い」という前提に合わない）。代わりに、**人が手で実行する手順書**として記載する。

## 1. `masahiro-cloudwatch-monsternote-api-5xx`が鳴った（API全体の5xx率が5分間で5%を超えた）

**前提**: `escalation-matrix.md` §2のとおり、現状このアラームの通知は実際には誰にも届かない。気づく手段は、CloudWatchコンソールでアラーム一覧を自分で確認するか、`dashboards.md`の「アラームの状態」ウィジェットを見ること。

1. **診断**: `dashboards.md`の「API の健康状態」ウィジェット（5xx・4xx・Count・Latency）で、どのルート・時間帯に集中しているかの手がかりを得る。ルート単位の内訳は`log-queries.md` §5「ルートごとの非2xx応答の件数」を実行する。
2. **よくある原因**:
   - 特定の関数のコードの不具合（デプロイ直後に多い。§3参照）
   - DynamoDBのスロットリング（§4参照。アラームは無いため、このアラームが唯一の間接的な手がかりになりうる）
   - Cognitoのトークン検証の失敗（§5参照。401/403はHTTP APIの既定の認可レイヤーで弾かれ、Lambda本体の5xxにはならないことが多いが、JWTオーソライザー自体の設定不整合は5xxになりうる）
3. **復旧**: 原因がコードであれば、直前のデプロイを疑い`rollback-runbook.md`の手順で前のタグに戻すかどうかを人に確認する。復旧にAWSへの変更が要る場合は、緊急時であっても必ず人に確認してから実行する（project.mdのMandated）。
4. **重大度**: 原因不明のままAPI全体に及ぶ場合はP1。特定ルートのみで他は正常ならP2。

## 2. `masahiro-cloudwatch-monsternote-lambda-errors-0`または`-1`が鳴った（関数グループのエラー合計が5分間で3回以上）

**前提**: グループ0は9関数（Accounts・AuditLog・Reporting・Review・Catalog・Settings・DuplicateDetection・ReviewOnSaved・CatalogOnSaved）、グループ1は3関数（CatalogOnStatus・DuplicateDetectionOnSaved・DuplicateDetectionOnStatus）。**このアラームだけではどの関数が原因か分からない**（`alarms.md` §3。複数関数のエラーを1つの数式で合計しているため）。

1. **診断**: CloudWatchコンソール → Lambda → 対象候補の各関数の「モニタリング」タブで`Errors`を個別に確認するか、`log-queries.md` §1の`requestId`追跡クエリ（API経由の呼び出しなら）を関数ごとのロググループに対して実行する。グループ内の関数名は`alarms.md` §1の表を参照。
2. **業務影響の判断**: グループ0にはReporting・Review・Catalogという報告の送信・承認・一覧という本流の関数が含まれる。これらでエラーが出ていればP1〜P2。グループ1は重複判定の後続処理（DuplicateDetectionOnSaved/OnStatus）とCatalogOnStatusで、本流が止まるわけではないためP2〜P3が目安。
3. **よくある原因と対応**:
   - 直前のデプロイでの不具合 → `rollback-runbook.md`で戻すか人に確認
   - DynamoDBのスロットリング（§4） → 一時的なもので収まりを待つか、読み書きパターンを見直す（コード変更が要るため即応はできない）
   - 外部サービス（Rekognition。U2のDuplicateDetection）の一時的な失敗 → `DETECTION_LIMIT_REACHED`のログ（`log-queries.md` §2）を確認。呼び出し上限超過であれば時間を置く以外に即応手段は無い（受け入れたリスク）

## 3. `cdk deploy`が失敗した（デプロイ途中でのエラー）

**実例（このプロジェクトで実際に発生）**: `docs/06-operation.md` §4.1に、CloudWatchアラームの指標数上限（1アラームにつき10個まで）を超えて`MonsterNote-Api-dev`が`UPDATE_FAILED`になった実例がある。入れ子の数式で回避しようとした設計が、CloudFormation上では平らに展開されて上限に抵触した。`cdk diff`では検出できず、実際に`cdk deploy`するまで分からなかった。

1. **診断**: `cdk deploy`のエラーメッセージを読む。`Too many metrics in alarm`のような具体的な制約超過のメッセージであれば、CDKコードの該当箇所を特定する。
2. **スタックが`ROLLBACK_COMPLETE`になった場合**: `rollback-runbook.md` §5の手順（空のスタックであることを確認 → 人に削除の可否を確認 → 削除してやり直す）に従う。
3. **修正後の再デプロイ**: `npx tsc --noEmit`・該当するCDK構成試験（`infra/test/stacks.u*.test.ts`）・`npm run synth`で合成したテンプレートを直接確認してから、再度人に確認のうえデプロイする（実例ではアラームの指標数を`python3`でテンプレートを読んで直接数えて確認した）。
4. **重大度**: デプロイが失敗した時点で旧バージョンは動き続けている（CloudFormationの変更セットの性質上、失敗したスタックは変更前の状態にロールバックされる。他の成功済みスタックは新バージョンのまま）ため、通常はP2〜P3（復旧を急ぐ必要はあるが、直ちにサービス停止するわけではない）。ただし失敗したスタックに依存する機能がすでに使えない状態ならP1。

## 4. DynamoDBのスロットリングに気づいた（または疑われる）

**前提**: `alarms.md` §5のとおり、DynamoDBのスロットリングを監視するアラームは意図的に追加していない（人の判断: f6a5a28c）。気づく手段は、5xx率アラーム経由の間接的な手がかりか、DynamoDBコンソールを自分で確認することのみ。

1. **診断**: DynamoDBコンソール → 対象の表（特に`ReportListItems`・`AuditEntries`のようにGSIを持つ表）→「モニタリング」タブで`ThrottledRequests`を確認する。
2. **対応**: すべての表は`PAY_PER_REQUEST`（オンデマンド）のため、持続するスロットリングであれば一時的なキャパシティの自動拡張を待つ（通常は短時間で解消する）。頻発する場合は、書き込みパターン（特定のパーティションキーへの集中）の見直しが要るが、これはコード変更であり即応手段ではない。
3. **重大度**: 単発ならP3（記録のみ）。業務の本流（報告の送信・承認）に影響する頻度・継続時間であればP2。

## 5. Cognitoでログインできない・JWT認可が通らない

1. **診断**: `POST /v1/session`が失敗するか（Cognito自体の問題）、個別のAPI呼び出しが401/403になるか（JWTオーソライザーの設定、またはトークンの期限切れ）を切り分ける。`log-queries.md`のクエリには認可失敗専用のものが無いため、関数のロググループを`requestId`または`accountId`で確認する。
2. **よくある原因**: アクセス/IDトークンの有効期限（1時間）切れでの再ログイン要求（通常のフロー。障害ではない）。Cognitoユーザープール自体の設定変更（`RemovalPolicy.RETAIN`のため通常は意図せず壊れない）。
3. **重大度**: 全利用者がログインできなければP1。特定のアカウント（無効化・パスワード再設定直後等）のみであれば業務上は正常な動作の可能性が高く、P3。

## 6. 報告が「知らせのないまま」残っている（eventSent=falseのまま）

**前提**: U1 reliability-designの「残るリスク」として明記されている既知の受け入れたリスク。送信が3回とも失敗し、ハンターが送り直さずにやめると、その報告は承認も一覧表示もできないまま残る。**気づくためのアラームは意図的に作っていない**（Q6）。U1の設計メモは「U4の管理者の画面で検討する」としていたが、実際にはU4でその機能は実装されていない（確認済み。`u4-accounts-admin`のコードに該当する管理機能は無い）。

1. **気づく手段**: 利用者（依頼元）から「送ったはずの報告が一覧に出ない」という申告を受けたときのみ、現状は気づける。
2. **調査**: DynamoDBコンソールで`Reports`テーブルを`submissionKey`または報告の内容で検索し、`eventSent`が`false`のままの項目を探す。
3. **復旧**: 現状、自動の再送ツールは無い。該当する`reportId`に対して`report.saved`イベントを手動でEventBridgeに送る（AWSコンソールまたはCLIから、該当のeventペイロード形式で）か、`eventSent`を`true`に書き換えたうえで利用者に送り直しを依頼する。どちらもAWSリソースへの直接の書き込みを伴うため、実行前に人に確認する（project.mdのMandated）。
4. **重大度**: 個別の報告1件であればP3（業務全体は止まっていない）。同時多発していれば、EventBridge自体かReporting関数の構造的な問題を疑い、P1〜P2に引き上げて調査する。

## Assumptions & Open Questions

Q1・Q2は`incident-response-questions.md`に記録（アラームのメール通知の配線、および本項6の再送手段を手順書のままにするか画面機能として作るか）。
