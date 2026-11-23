# Unit Test Instructions — U1 `u1-skeleton`

入力: code-generation-plan.md、`construction/u1-skeleton/nfr-requirements/tech-stack-decisions.md`、team.md の Testing Posture（TDD、Vitest・Playwright・aws-cdk-lib/assertions、行カバレッジ 80%）。

## 1. 準備

- Node.js 22.12 以上と npm（Vitest 5・jsdom 31 のため。nvm を使う場合は `nvm use 24` など）。ルートで `npm ci`（初回は `npm install`）。
- DynamoDB Local は npm のパッケージで起動する（Docker は使わない。Java 17 以上が要る）。結合の試験が自分で起動・停止する。
- Playwright のブラウザ: `npx playwright install chromium webkit`（初回だけ）。
- AWS の認証情報は要らない（すべてモックか DynamoDB Local）。

## 2. U1 のテストを動かすコマンド

U1 のテストファイルは、名前に `.u1.test.` / `.u1.spec.` を含む。コマンドはこの名前で U1 だけに絞る。

| 目的 | コマンド |
|---|---|
| U1 の単体・結合・画面の部品・CDK の構成の試験 | `npx vitest run .u1.test.` |
| U1 の E2E（AWS なし、API はモック） | `npx playwright test --grep @u1` |

TDD の各 Red は、対象のファイルの名前で失敗を確かめる（例: `npx vitest run auth.u1.test`）。3 つのプロジェクト（backend・frontend・infra）は `vitest.config.ts` の `test.projects` で読み込まれる（Vitest 5 で `--workspace` がなくなったため。人の承認で手順書を更新）。

Step 1（テストの準備）のあと、テストがまだないとき、1 行目のコマンドは「テストがない」で終わる。これが Red の前の確認。

## 3. カバレッジ

- 床: 画面と API のロジック（`backend/src`・`frontend/*/src`）の**行カバレッジ 80% 以上**（team.md、NFR13.1）。CDK（`infra/`）は割合の対象から外し、構成の試験で確かめる。
- この床はプロジェクト全体の床なので、Build and Test が全部のテストで測る。U1 だけのコマンドでは判定しない（ほかの Unit のファイルが加わると数字が変わるため）。
- U1 の時点の確認（参考）: `npx vitest run --coverage .u1.test.`。床のしきい値で終わりの状態が失敗になっても、選んだテストがすべて通っていれば、テストの失敗ではない（Build and Test で全体を測る）。しきい値は下げない。

## 4. モックと試験用のデータ

| 相手 | 置き換え |
|---|---|
| DynamoDB | 単体: `aws-sdk-client-mock`。結合: DynamoDB Local（試験ごとに表を作って消す） |
| S3（署名付きの URL・実物の確認） | `aws-sdk-client-mock`（HeadObject の応答を差し替える） |
| Cognito（InitiateAuth・RevokeToken・AdminCreateUser） | `aws-sdk-client-mock` |
| EventBridge（PutEvents） | `aws-sdk-client-mock`。失敗を 1〜3 回返して、やり直しと 500 を確かめる |
| Lambda の直接の呼び出し（C10） | `aws-sdk-client-mock`（Invoke の応答を差し替える） |
| 画面の API | Vitest: `msw`（Mock Service Worker）。Playwright: 試験用のモックのサーバー |
| 時刻 | `vi.useFakeTimers()`（作成中の 30 秒の期限、トークンの期限） |

試験用のデータは各テストの中で作り、ほかのテストと共有しない。個人情報に見える値（実在の名前・住所）は使わない（例: `hunter-a`、緯度経度は試験用の固定の値）。

## 5. 期待する数

| 層 | 試験の数の目安（Standard: 部品ごとに 5〜8） |
|---|---|
| backend shared（auth・logger・errors・events・http） | 約 25 |
| Accounts（session・eligibility） | 約 14 |
| Reporting（photos・submit・get-report） | 約 24 |
| Review（on-saved・decision・get-review） | 約 14 |
| ReportCatalog（on-events・list） | 約 14 |
| 結合（skeleton-flow） | 約 4 |
| スクリプト（create-account） | 約 6 |
| 画面（ui-kit・hunter・requester） | 約 30 |
| CDK の構成の試験 | 約 25 |
| E2E（Playwright） | 6 |

各ファイルには、正常の流れと、少なくとも 2 つのエラー・角のケースを入れる（phases/construction.md）。
