# Code Summary（作ったものの要約）— U1 `u1-skeleton`

入力: code-generation-plan.md（承認済み、38 ステップ）、unit-test-instructions.md、Testing Contract（TDD、`sha256:d7b37dee…0325`）、functional-design・nfr-requirements・nfr-design・infrastructure-design の各文書、contract-summary。

## 1. 作ったもの（ファイル）

アプリのコードはワークスペースのルートに置いた（`aidlc/` の下には置いていない）。一覧は `source-manifest.json` にある。

| 場所 | 中身 |
|---|---|
| ルート | `package.json`（npm workspaces: backend・frontend・infra、`verify`・`smoke`・`test:u1`・`account:create` など）、`package-lock.json`、`tsconfig.base.json`（strict）、`eslint.config.js`（typescript-eslint、`react/no-danger`）、`.prettierrc`・`.prettierignore`、`vitest.workspace.ts`（3 つのプロジェクトの一覧）、`vitest.config.ts`（`test.projects` でその一覧を読む。v8 のカバレッジ、行 80%）、`playwright.config.ts`、`.nvmrc`、`.gitignore`（足すだけ） |
| `backend/src/shared/` | `auth.ts`（`getCaller`・`requireRole`・`requireOwner`）、`errors.ts`（共通のエラーの形）、`logger.ts`（出してよい項目だけの JSON）、`events.ts`（EventEnvelope、最大 3 回・0.1/0.2 秒の送信、1 回 0.5 秒の時間切れ）、`http.ts`（応答・requestId・道の振り分け）、`processed-events.ts`（受け手の 2 回目の無視、TTL 7 日）、`dynamo.ts`、`env.ts` |
| `backend/src/accounts/` | `session.ts`（ログイン・出し直し・ログアウト）、`eligibility.ts`（C10）、`repository.ts` |
| `backend/src/reporting/` | `photos.ts`（署名付きの POST・完了の確認）、`submit.ts`（送信のキー・C10・トランザクション・report.saved）、`get-report.ts`（15 分の表示用 URL）、`repository.ts` |
| `backend/src/review/` | `on-saved.ts`、`decision.ts`、`get-review.ts`、`repository.ts` |
| `backend/src/catalog/` | `on-saved.ts`、`on-status.ts`、`list.ts`（50 件・cursor・全件数）、`repository.ts`（gsiAll・gsiHunter） |
| `backend/src/handlers/` | Lambda の入口 7 つ（accounts・reporting・review・catalog・review-on-saved・catalog-on-saved・catalog-on-status）と `consumers.ts` |
| `backend/test/` | 試験の補助（`helpers/`）と結合の試験 `integration/skeleton-flow.u1.test.ts`（DynamoDB Local） |
| `frontend/ui-kit/src/` | 部品（LoginForm・AppShell・StepHeader・PhotoPicker・BigChoice・LocationGate・SubmitButton・ReportList・StatusChip・ReportDetail・DecisionBar）、`theme.ts`（hunterTheme 20px/64px・staffTheme 16px/48px）、`api/client.ts`（Bearer・10 秒・requestId・401 で出し直し）、`session/`（出し直し用の値は localStorage、証明はメモリ）、`config.ts`（`loadConfig`）、`image/resize.ts`（長辺 2,048 px）、`AppFrame.tsx`、`labels.ts` |
| `frontend/hunter/` | HunterApp（ログイン → ホーム → 写真 1/3 → 種類と雌雄 2/3 → 送信 3/3 → 完了）、Vite の設定 |
| `frontend/requester/` | RequesterApp（ログイン → 一覧 → 詳細と承認）、Vite の設定 |
| `frontend/test/` | 試験の準備（jest-dom、msw） |
| `infra/` | `bin/app.ts`、`lib/{auth,web,data,api,web-content}-stack.ts`、`lib/tagging-aspect.ts`、`lib/monsternote.ts`（5 つのスタックの組み立て、qualifier `mnote`）、`cdk.json`、`test/stacks.u1.test.ts`、`.env.local.example`（値なし） |
| `scripts/` | `create-account.ts`（BR5.1）、`smoke.ts`（7 手順）、試験 |
| `e2e/` | `skeleton.u1.spec.ts`（6 件、`@u1`）、`mock-api.ts`（AWS なしの API のモック） |
| `contracts/` | `openapi.yaml`（C1〜C4 の U1 の道。`uploadFields` と source の `device` を足した）、`asyncapi.yaml`（C12・C13） |
| `.github/workflows/ci.yml` | push と PR: `npm ci` → format:check → lint → typecheck → Vitest（カバレッジ）→ Playwright（AWS なし）→ `cdk synth`。AWS の認証情報は使わない |

`infra/.env.local` は作っていない（秘密情報。見本の `infra/.env.local.example` だけ）。

## 2. 主な判断

- **TDD の進め方**: 層ごとに先に失敗する試験を書き、`npx vitest run --workspace vitest.workspace.ts <名前>.u1.test` で失敗（「Failed to load url ./xxx」= 実装がない）を確かめてから実装した（依存を上げる前の Vitest 2 のコマンド）。Red の記録は `memory.md` にある。
- **証明**: 画面は ID トークンを Bearer で送る（JWT オーソライザーの `aud` とクライアントの ID が合い、`cognito:groups` と `name` が入るため）。HTTP API は `cognito:groups` を `"[hunter]"` の文字列にするので、配列と文字列の両方を読む。
- **確認した人の名前**: 承認の `decidedByName` は ID トークンの `name`（アカウントを作るスクリプトが Cognito の `name` に表示名を入れる）から取る。Review は Accounts を呼ばない。
- **送信のキー**: 表 `SubmissionKeys` に「作成中（30 秒）」を条件付きで書き、保存のトランザクションで「保存済み」にする。保存の前に失敗したら「作成中」を消して、すぐに送り直せるようにした。
- **知らせの送り直し**: 保存済みで eventSent が「まだ」の送り直しでは、表示名を C10 で読み直して report.saved を送る（新しい eventId。受け手は報告ごとに冪等）。
- **一覧の索引**: `listPartition='ALL'`／`hunterAccountId` ＋ `sortKey=submittedAt#reportId`。report.saved が届くまで sortKey を書かないため、状態だけ先に届いた行は索引に入らず、一覧に出ない（BR4.1）。次のページは 51 件読んで決める（最後のページの cursor は null）。cursor のパーティションは利用者本人に固定する。
- **CDK**: 関数のまとめはローカルの esbuild（Docker なし）。試験では `aws:cdk:bundling-stacks` を空にしてまとめない。Cognito のリフレッシュトークンの更新（rotation、猶予 60 秒）は L1 の上書きで設定した。

## 3. 試験の結果

| 種類 | 件数 | 結果 |
|---|---|---|
| backend（shared・accounts・reporting・review・catalog・handlers・scripts） | 136 件（16 ファイル） | すべて成功 |
| 結合 skeleton-flow（DynamoDB Local） | 4 件 | **実行していない（飛ばした）**。下の 5 を参照 |
| frontend（ui-kit の部品・apiClient・loadConfig・画面の流れ） | 55 件（12 ファイル） | すべて成功 |
| CDK の構成の試験 | 28 件 | すべて成功 |
| E2E（Playwright、chromium） | 6 件 | すべて成功 |
| E2E（Playwright、mobile-webkit） | 6 件 | **実行できなかった**。下の 5 を参照 |

上の数は依存の版を上げたあと（9 節）、Node.js 24.16.0 で実行したもの。

U1 のコマンド: 承認済みの手順の `npx vitest run --workspace vitest.workspace.ts .u1.test.` は、Vitest 5 では `--workspace` がなくなったため動かない（`CACError: Unknown option --workspace`）。同じ試験を選ぶ `npx vitest run .u1.test.`（`npm run test:u1`）で 219 件成功、4 件飛ばし（30 ファイル）。手順の書き換えは人の承認が要る（8 節）。

## 4. カバレッジ

`npx vitest run --coverage .u1.test.`（`npm run test:coverage` と同じ。対象は `backend/src`・`frontend/*/src`。CDK は対象外で、構成の試験で確かめる）:

| 指標 | 依存を上げる前（Vitest 2） | 上げたあと（Vitest 5） |
|---|---|---|
| 行（Lines） | 96.25%（2774/2882） | **93.00%**（918/987）— 床 80% を上回る |
| 文（Statements） | 96.25% | 90.24% |
| 分岐（Branches） | 89.33% | 82.58% |
| 関数（Functions） | 90.29% | 88.16% |

試験とコードの中身は同じで、数が変わったのは Vitest 4 以降の v8 のカバレッジが行の数え方を変えた（実行できる行だけを数える）ため。床 80% は全体の床として Build and Test が全部の試験で測る。しきい値は下げていない。画面の起動だけを行う `frontend/*/src/main.tsx` はカバレッジの対象から外した（ブラウザで E2E が確かめる）。

## 5. 書いたが、このステージで実行していない試験

| 試験 | 理由 |
|---|---|
| `backend/test/integration/skeleton-flow.u1.test.ts`（4 件） | この PC に Java がない（`java: command not found`。Docker もない）。DynamoDB Local は Java 17 以上が要るため起動できない。試験は Java がないと「飛ばした」と表示する（成功にはしない）。CI（`ci.yml`）は Java 17 を入れて動かす |
| E2E の `mobile-webkit`（6 件） | `npx playwright install chromium webkit` でブラウザは入ったが、WebKit を動かす OS のライブラリ（libwoff2dec・libgles2 など）が足りない（「Host system is missing dependencies」）。入れるには `sudo npx playwright install-deps` が要るため実行していない。CI は `--with-deps` で入れる |
| CI（GitHub Actions） | push していないため動いていない（コミット・push はしていない） |
| `npm run smoke` | dev にデプロイしていないため（デプロイは人の承認のあと。cicd-pipeline 段階 4〜6） |

## 6. `npm run verify` の部分ごとの結果（手元、依存を上げたあと、Node.js 24.16.0）

| 部分 | 結果 |
|---|---|
| format:check（Prettier 3.10.1） | 成功 |
| lint（ESLint 9.39.5、react-hooks 7.1.1） | 成功 |
| typecheck（5 つの tsconfig、TypeScript 5.9.3） | 成功 |
| test:coverage（Vitest 5.1.1） | 成功（219 件成功・4 件飛ばし、行 93.00%） |
| test:e2e（Playwright 1.65.1） | **失敗**: chromium 6/6 成功、mobile-webkit 6 件は OS のライブラリがなく起動できない |
| synth（画面のビルド ＋ `cdk synth`、aws-cdk-lib 2.278.0） | 別に実行して成功（AWS に接続していない。デプロイ・bootstrap はしていない） |

`verify` 全体の終わりの状態は失敗。原因は WebKit の OS のライブラリだけ（依存を上げる前と同じ）。

**手元の Node.js**: この PC の既定は 20.20.2 だが、Vitest 5 と jsdom 31 は Node.js 22.12 以上が要る（20 では画面の試験が起動しない）。そのため、すでにこの PC に入っていた Node.js 24.16.0（nvm）で実行した。CI と Lambda は 22 のまま（`.nvmrc` 22、`engines` を `>=22.12` にした）。

## 7. 計画からのずれ

- **報告の表に `bodyPhotoId` を持たせた**（計画の Reports の項目の一覧にない）。この項目は約束 C12 から来ている: `report.saved` の中身（contract-summary 5）に `bodyPhotoId` があり、知らせを送り直す（NFR10.3）ときにも同じ値を入れるため、報告に持たせる必要がある。写真の表示（BR6.1）でも、報告から写真を引くのに使う（Photos の reportId から探すには索引か scan が要る）。計画の `## Assumptions` には載っていない。
- **計画にない補助のファイル**: `infra/lib/monsternote.ts`・`infra/cdk.json`、`backend/src/handlers/*`、`backend/src/shared/{dynamo,env,processed-events}.ts`、`frontend/ui-kit/src/{AppFrame.tsx,session/*,labels.ts,image/resize.ts}`、`frontend/hunter/src/context.tsx` など、計画のステップを動かすのに要るもの。試験も `http.u1.test.ts`・`handlers.u1.test.ts`・`client.u1.test.ts`・`config.u1.test.ts` を足した。
- **計画にない道具**: `tsx`（スクリプト・モックの API・CDK のアプリを TypeScript のまま動かす）。ルートの `vite`（7.3.8）も足した（Vitest が別の版の Vite を入れ、画面の Vite と型がぶつからないようにするため）。以前の `playwright-core` の `overrides` は、依存を上げて版がそろったため外した。
- **依存の版を上げた**（人の指示。9 節）。
- **E2E の番号と起動の仕方**: この PC で別のプロジェクトの Vite が 5173 を使っていたため、画面 5273・5274、モックの API 4610 にし、既存のサーバーを使い回さない設定にした。開発サーバーでは遅延読み込みの依存の最適化で画面が止まったため、E2E はビルドしたもの（`vite preview`）で動かす。
- **画面の S3 は RETAIN**: 仕様は「作り直してよい」。中身のある S3 は消せず、自動で消す仕組み（autoDeleteObjects）は x86 の追加の関数を作るため、残す設定にした（費用はほぼ 0）。
- **承認の `rejected` は 400**（却下は U3）。
- **`audit.recorded` は送っていない**: observability-design 4 にあるが、承認済みの計画のステップにないため作っていない（受け手は U4）。U4 までに足す必要がある。
- **`.gitignore`**: 計画の行に加えて `!.env*.example`（見本をコミットできるように）と `*.pem`（security-design NFR6.1）を足した。足すだけで、既存の行は変えていない。
- **ステップの順番**: `errors.ts` は Step 3（auth が使う）で、`api/client.ts` は Step 29（DecisionBar が使う）で先に作ったため、`errors.u1.test.ts` と `client.u1.test.ts` は最初の実行から成功した（Red を見ていない）。catalog の `repository.ts` の一覧の関数は Step 21 で先に書いた。
- **手元の Node.js**: 最初の生成は 20.20.2 で試験した。依存を上げたあとは 24.16.0 で試験した（6 節）。Lambda は nodejs22.x、CI は 22。

## 8. 気になる点（次のステージへ）

- **承認済みの試験の手順のコマンドが動かない**: `unit-test-instructions.md` の `npx vitest run --workspace vitest.workspace.ts …` は Vitest 5 で動かない。代わりは `npx vitest run .u1.test.`（Red は `npx vitest run <名前>.u1.test`、参考のカバレッジは `npx vitest run --coverage .u1.test.`）。手順のファイルは変えていない（変えるには人の承認が要る）。Build and Test の前に直す必要がある。
- 結合の試験（DynamoDB Local）と WebKit の E2E は、Java と WebKit の OS のライブラリがある環境（CI など）で実行して確かめる必要がある。

## 9. 依存の版を上げた（人の指示: レビューの前に依存を上げる）

方針: `npm audit` の critical と high を 0 にし、道具は今の安定版にした。画面の土台は tech-stack-decisions で決めた系列（React 18 系・MUI 6 系）の最新にした（React 19・MUI 9 は別の判断が要る大きな変更のため）。React Router は audit の中程度の指摘（7.18.0 未満の open redirect）も消すため 7 系にした。

| パッケージ | 前 | 後 |
|---|---|---|
| @aws-sdk/*（8 つ） | 3.723.0 | 3.1175.0 |
| aws-cdk-lib / aws-cdk（CLI） / constructs | 2.202.0 / 2.1018.0 / 10.4.2 | 2.278.0 / 2.1149.0 / 10.8.1 |
| esbuild（infra） | 0.24.2 | 0.28.2 |
| vitest / @vitest/coverage-v8 | 2.1.9 | 5.1.1 |
| vite / @vitejs/plugin-react | 5.4.21 / 4.3.4 | 7.3.8 / 5.2.0 |
| react-router-dom | 6.28.1 | 7.18.6 |
| @mui/material・@mui/icons-material | 6.4.0 | 6.5.0 |
| react・react-dom | 18.3.1 | 18.3.1（そのまま） |
| @playwright/test / @axe-core/playwright | 1.49.1 / 4.10.1 | 1.65.1 / 4.13.0 |
| eslint・@eslint/js / typescript-eslint / eslint-plugin-react-hooks | 9.39.1 / 8.46.0 / 5.1.0 | 9.39.5 / 8.73.0 / 7.1.1 |
| typescript / prettier / tsx / globals | 5.7.2 / 3.4.2 / 4.19.2 / 15.14.0 | 5.9.3 / 3.10.1 / 4.23.15 / 17.14.0 |
| jsdom / msw / @testing-library/jest-dom | 25.0.1 / 2.7.0 / 6.6.3 | 31.0.1 / 2.15.0 / 8.0.0 |
| dynamodb-local / @types/aws-lambda / @types/node | 0.0.34 / 8.10.146 / 22.10.2 | 0.0.38 / 8.10.164 / 22.20.5 |

**npm audit**:

| | 前 | 後 |
|---|---|---|
| `npm audit`（開発用を含む） | 55 件（critical 29・high 11・moderate 15） | **0 件** |
| `npm audit --omit=dev` | 35 件（critical 25・high 7・moderate 3） | **0 件** |

**上げたことで直したところ**（試験を弱めたり、規則を止めたりはしていない）:
- Vitest 4 以降は `defineWorkspace` と `--workspace` がない: `vitest.workspace.ts` をプロジェクトの一覧にし、`vitest.config.ts` の `test.projects` から読む。`package.json` の `test`・`test:coverage`・`test:u1` から `--workspace` を外した。
- React Router 7: `future` の指定（v7 の振る舞いを先に使う印）がなくなったため外した（v7 では既定）。
- eslint-plugin-react-hooks 7 の新しい規則 `set-state-in-effect`: `HomePage`・`ListPage`・`LocationGate` は、効果の中で同期的に状態を書き換えず、読み終わったあとに書き換える形に直した。`DonePage` の `eslint-disable`（exhaustive-deps）も、`clearDraft` を変わらない関数にして外した（規則を止める書き方がなくなった）。
- aws-cdk-lib: `Stack#addDependency` が非推奨になったため `addStackDependency` にした。`cdk.json` に `@aws-cdk/core:defaultCrossStackReferences: "strong"` を入れた（今の振る舞いを明示する。synth の警告への対応）。
- 試験: `@smithy/util-stream`（直接の依存ではない）の読み込みをやめ、Lambda の応答をバイト列で作る形にした。
- npm 10.8.2（Node.js 20 に付く版）は、Vitest の任意の依存（`@vitejs/devtools`）の解決で落ちる（`Cannot read properties of null (reading 'edgesOut')`）。最初のロックファイルは `npm install --legacy-peer-deps` で作り、そのあと Node.js 24 の npm 11.13.0 で、何も付けない `npm install` と `npm ci` が通ることを確かめた。CI（Node.js 22）は `npm ci` を使う。

**まだ実行できないもの**（依存を上げる前と同じ）: DynamoDB Local の結合の試験 4 件（Java がない）、WebKit の E2E 6 件（OS のライブラリがない。`sudo npx playwright install-deps` が要る）、`npm run smoke`（デプロイしていない）、CI（push していない）。

## Sources

- 承認済みの計画: `construction/u1-skeleton/code-generation/code-generation-plan.md`
- 試験の手順: `construction/u1-skeleton/code-generation/unit-test-instructions.md`
- 設計: `construction/u1-skeleton/{functional-design,nfr-requirements,nfr-design,infrastructure-design}/`、`inception/contract-design/contract-summary.md`
