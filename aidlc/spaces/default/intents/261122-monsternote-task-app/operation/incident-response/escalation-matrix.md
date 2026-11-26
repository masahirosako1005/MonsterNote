# Escalation Matrix — Incident Response

入力: `operation/observability-setup/alarms.md`（実際のアラーム・SNSトピック）、`infra/.env.local`・`infra/bin/app.ts`（アラームの通知先の実際の配線）、`aidlc/spaces/default/memory/project.md`（Forbidden・Mandated）、`aidlc/spaces/default/memory/team.md`（Deployment節）。

## 1. 体制: 1人（開発者本人）。多段階のオンコール・PagerDuty等は無し

このプロジェクトは開発者1人の個人開発であり、交代要員・2次対応者はいない。project.mdの前提（共用アカウント・無料枠・少人数の試験運用のMVP）にも、有償のオンコール基盤（PagerDuty・Opsgenieのようなサービス）を使う理由がない。したがって本ステージが示す「エスカレーション経路」は、企業のオンコール表ではなく、**「アラームが鳴ったら開発者本人が気づく」という1段階の経路が実際にどう配線されているか（と、配線できていない箇所）**である。

| 役割 | 担当 | 連絡手段 |
|---|---|---|
| 一次対応（唯一の対応者） | 開発者本人 | SNSトピック`masahiro-sns-monsternote-alarm`からのメール（§2参照。現状未配線） |
| 二次対応 | 無し | — |
| 利用者（ハンター・依頼元）への連絡 | 無し（試験運用。利用者向けの状態ページ・一斉通知の仕組みは作らない） | — |

## 2. 見つけた重大なギャップ（解決済み）: アラームの通知先メールが実際には設定されていなかった

`infra/lib/api-stack.ts`は`if (props.alarmEmail) topic.addSubscription(new EmailSubscription(props.alarmEmail));`という条件付きの配線になっており、`alarmEmail`はCDKのコンテキスト（`cdk deploy -c alarmEmail=...`）から渡す設計（`infra/bin/app.ts`）。

本ステージの調査時点で確認したところ:
- `infra/.env.local`の`ALARM_EMAIL`は空欄だった。
- `operation/deployment-execution/deployment-log.md`に記録された実際の`cdk deploy`コマンド（`AWS_PROFILE=default npx cdk deploy --all --require-approval never`）には、一度も`-c alarmEmail=...`が渡されていなかった。

つまり、当時`dev`で動いていた3つのアラーム（`alarms.md`）はSNSトピック`masahiro-sns-monsternote-alarm`に正しく通知を送るが、そのトピックには実際には誰も購読していなかった。アラームが`ALARM`状態になっても、開発者には何も届かない状態だった。これは監視の設計（アラーム3個）とは別の、通知経路の配線漏れであり、`health-check-report.md`の確認（アラームの状態が`OK`かどうかのみ確認）でも気づかれていなかった。本ステージで新たに発見した。

**対応済み**: 人に報告し（記録: f155a9f9）、通知先メールアドレス（`mhiro10mhiro10@gmail.com`）を教えてもらい、`infra/.env.local`の`ALARM_EMAIL`に設定。`cdk diff`で差分（SNSサブスクリプション1件・observability-setupで承認済みのCloudWatchダッシュボード1件の新規追加のみ）を人に示し、承認を得てから`cdk deploy MonsterNote-Api-dev -c alarmEmail=mhiro10mhiro10@gmail.com`を実行した。デプロイ直後は`aws sns list-subscriptions-by-topic`で`SubscriptionArn: PendingConfirmation`（確認メール未クリック）だったが、人が確認メールのリンクをクリックした後に再確認し、実際のARN（`...masahiro-sns-monsternote-alarm:636bceb2-...`）が付いて購読が有効になったことを確認した（記録: 966e2359・9f8dd0e0）。

## 3. 内部の制約（緊急時でも変わらない）

インシデント対応中であっても、次のproject.md・team.mdの決まりは**緊急避難的にも変えない**:

- **mononokeのリソースには触れない**（project.md Forbidden）。障害対応がmononoke-backend-devスタックや、同じアカウントの他プロジェクトのリソースに触れることは絶対にない。
- **AWSへのデプロイ・削除は、緊急時であっても必ず人に確認してから実行する**（project.md Mandated「ALWAYS ask the human before running any deploy or destroy against AWS」）。「とりあえず再デプロイして直す」という判断は、たとえ障害対応中でも一存ではできない。
- 秘密情報（AWS認証情報・`.env*`・パスワード）をコミットしない（project.md Forbidden）。障害調査でログや設定を貼り付ける際も同様。
- 常時課金リソース（EC2・RDS・NAT Gateway等）を緊急対応のために追加しない（project.md Forbidden）。

## 4. Assumptions & Open Questions

None（Q1・Q2とも`incident-response-questions.md`で回答・解決済み）。
