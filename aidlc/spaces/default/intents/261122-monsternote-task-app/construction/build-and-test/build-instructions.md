# Build Instructions — Build and Test

入力: U1〜U4 の `code-generation-plan.md`・`unit-test-instructions.md`・`code-summary.md`、`package.json`（npm workspaces: `backend`・`frontend`・`infra`・`scripts`）、`.github/workflows/ci.yml`。

## 1. 依存関係のインストール

```bash
npm ci
```

ルートの `package.json` が npm workspaces（`backend`・`frontend`・`infra`・`scripts`）をまとめて管理する。個別の `npm install` は不要。

## 2. 環境の準備

- Node.js 22（`.nvmrc` 参照）。
- 結合試験（DynamoDB Local）は Java 17 以上が要る（npm パッケージが自分で起動・停止する。Docker は使わない）。
- Playwright のブラウザ（初回のみ）: `npx playwright install chromium webkit`。
- AWS の認証情報は一切不要（単体・結合・E2E はすべてモックか DynamoDB Local。`cdk synth` はテンプレートの生成だけで、AWS には接続しない）。
- 環境変数・設定ファイルの用意は不要（`.env` 等はリポジトリに置かない。project.md の Forbidden）。

## 3. ビルドのコマンド

このリポジトリに個別の「コンパイル」はなく、`npm run verify` の中の `synth` が実質のビルド検証を兼ねる:

```bash
npm run build:web      # frontend（hunter・requester）を vite build
npm run synth --workspace infra   # 上記の成果物を取り込み、CDK で cdk synth（5スタック）
```

まとめては `npm run synth`（= `build:web && synth --workspace infra`）。

## 4. ビルドの確認

- `vite build` が2つのアプリ（hunter・requester）それぞれで成功し、`dist/` 以下にアセットが出力されること。
- `cdk synth` が5つのスタック（MonsterNote-Auth-dev・Web-dev・Data-dev・Api-dev・WebContent-dev）をエラーなく合成し、`infra/cdk.out/` にテンプレートを書き出すこと（12個のLambda関数がesbuildでバンドルされることを含む）。
- IaCの静的チェック: `cdk synth` 自体がCDKの型チェック・トークン解決を兼ねる。追加のpolicy-as-code（cfn-guard等）はこのプロジェクトでは採用していない（team.md に記載なし）。`npm run lint`・`npm run typecheck` が全ワークスペース（backend・frontend・infra・scripts）に対して実行され、`infra/lib/*.ts` の型もここで検査される。

## 5. よくある詰まりどころ

| 症状 | 対処 |
|---|---|
| 結合試験が「DynamoDB Local を起動できない」で失敗 | Java 17 以上が入っているか確認（`java -version`）。ポート衝突時は前回のプロセスが残っていないか確認 |
| Playwright の E2E が「ブラウザが見つからない」で失敗 | `npx playwright install chromium webkit` を実行 |
| `cdk synth` が `AI agent detected` の警告を出す | 既知の既定動作（AWS CLI 側の表示）。失敗ではない |
| `npm run lint`・`npm run typecheck` が特定のワークスペースだけ失敗 | ルートの `tsconfig.base.json`・`eslint.config.js` を参照しているか、対象ワークスペースの `tsconfig.json` を確認 |
| カバレッジの床（80%）に届かない | `infra/` 配下は対象外（CDKの構成はCDKの試験で確かめる）。`backend/src`・`frontend/*/src` が対象 |

## 6. 唯一の「すべて確かめる」コマンド

```bash
npm run verify
```

`format:check → lint → typecheck → test:coverage → test:e2e → synth` の順に実行する、このプロジェクト自身が定義した「完了の定義」コマンド（`aidlc-state.md` の Construction Verification Command）。CI（`.github/workflows/ci.yml`）もこれと同じ内容を push・PR のたびに実行する。
