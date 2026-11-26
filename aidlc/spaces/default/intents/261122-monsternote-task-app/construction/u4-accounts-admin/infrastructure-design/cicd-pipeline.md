# CI/CD Pipeline（ビルド・試験・デプロイの流れ）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/infrastructure-design/cicd-pipeline.md`（U1 の流れ。そのまま使う）、infrastructure-specification.md、monitoring-design.md、`construction/u4-accounts-admin/nfr-requirements/tech-stack-decisions.md`（NFR13.9・NFR13.11〜NFR13.13）。

U1 の流れは変えない。U4 で足すのは CI の試験内容、デプロイ前の確認（最後の Unit であることの確認）、スモークの手順。

## 1. CI（AWS に接続しない）での追加

| 対象 | 試験の内容 |
|---|---|
| 単体試験 | AdminCounter の `TransactWriteItems`（作成時+1、無効化時「2以上」条件で-1、有効化時+1、最初の管理者の `if_not_exists`）のロジック（NFR13.11）。「すべて削除」の `BatchWriteItem` ループのロジック（NFR13.12） |
| 結合試験 | DynamoDB Local で `AdminCounter`・`AuditEntries` の読み書きを確認。同時に 2 つの無効化を起動して 1 回だけ成功することを確認（NFR13.11） |
| スクリプトの試験 | `create-account.u1.test.ts` に `--role admin` のケースを足す（NFR13.13） |
| E2E（AWS なし） | アカウント作成画面（仮のパスワードの表示）、「すべて削除」の確認画面、削除の進み具合の画面 |
| CDK の構成の試験 | `catalog`・`review`・`duplicate-detection`・`reporting` の 4 関数の時間切れが 15 秒になっていること、`accounts`・`settings` は変わっていないこと、`audit-log` 関数のメモリ・時間切れ（128 MB・10 秒）、Cognito の IAM 権限（`AdminCreateUser` 等）が `accounts` 関数だけに付いていることを確認する |

## 2. デプロイ前の確認（更新）

U1 の「`cdk diff --all` の結果と費用の見込みを示す」に加え、以下を示す:
- U4 がこのプロジェクトの最後の Unit であり、デプロイ後は MonsterNote の全機能（ハンター・依頼元・管理者）が揃うこと
- 4 つの関数の時間切れの変更（8/9/10 秒 → 15 秒）が、それぞれの既存のルートに影響しないことの確認結果（infrastructure-specification.md §1 の表）

## 3. スモーク（U4 で足す手順）

U1〜U3 のスモークのあとに続けて行う:

| # | 内容 |
|---|---|
| 16 | 試験用の管理者でログインし、新しいアカウント（ハンター）を作成する。仮のパスワードが 1 回だけ表示されることを確認する |
| 17 | 作成したアカウントでログインし、パスワードの変更を求められることを確認する |
| 18 | 試験用の管理者を 1 人追加作成し、最初の管理者を無効化できる（2 人以上なら成功）ことを確認する。残り 1 人になったら無効化できない（422 LAST_ADMIN）ことを確認する |
| 19 | 操作の記録の一覧（`GET /v1/admin/audit-entries`）に、これまでのスモークの操作（報告の送信、承認、却下など）が記録されていることを確認する |
| 20 | 「すべて削除」を実行し、5 つの入口がすべて成功し、報告・一覧が 0 件になることを確認する（試験用のスモークデータのみを対象にするか、別の使い捨て環境で行う） |

**注意**: #20（すべて削除）は破壊的な操作のため、本番相当のデータがある環境では実行しない。試験運用の開始前、または専用の検証目的でのみ実行し、実行前に必ず人の承認を得る（project.md の Mandated）。

## Assumptions & Open Questions

- #20 のスモークは、通常のデプロイのたびには実行しない（データを消してしまうため）。初回のデプロイ検証時、または試験運用の終了時にのみ、人の承認のもとで実行する。 [assumption]
