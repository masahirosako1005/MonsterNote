# 02 環境構築：AI-DLC2 を Claude Code にセットアップする

> 実施日: 2026-11-23 ／ AI-DLC 2.11.4 ／ Claude Code 2.1.330 ／ WSL2 (Linux 6.6)

## ゴール
- `aidlc` コマンドをインストールし、プロジェクトに Claude Code 用の AI-DLC を設定する
- `aidlc doctor` で問題 0 件を確認する

## 前提
| ツール | 状態 | 備考 |
|---|---|---|
| Claude Code | インストール・ログイン済み | 既存の認証をそのまま使う（Bedrock は不使用） |
| git | あり | |
| gh (GitHub CLI) | あり | インストーラがリリースの署名検証に使う |
| aws CLI | あり | 07章（AWS デプロイ）で使用 |
| Bun / Node.js | 不要 | ネイティブインストーラが同梱 |

## 手順

### 1. プロジェクトフォルダを git リポジトリにする
```bash
cd ~/Project/Claude/20261123_AIDLC
git init -b main
git config user.name "Your Name"          # このリポジトリだけに設定
git config user.email "you@example.com"
```

### 2. aidlc コマンドをインストール
```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
```
出力:
```
Downloaded version.json
Downloaded checksums.txt
Downloaded aidlc-release.intoto.jsonl
Downloaded aidlc-linux-x64
Downloaded aidlc-runtime-2.11.4.tar.gz
PASS installed AI-DLC 2.11.4 with all harness runtimes
Plugin marketplace for Claude Code and Codex: ~/.local/share/aidlc/plugins (add it once; updates keep it current)
Next: aidlc config
```
- インストール先: `~/.local/bin/aidlc`（コマンド）と `~/.local/share/aidlc/`（本体）。sudo は不要。
- インストーラは SHA-256 チェックサムで改ざんを確認し、`gh` があればリリースの署名（provenance）も検証する。
- `~/.local/bin` が PATH にない場合は、表示された `export PATH=...` を実行し `~/.bashrc` にも追記する。

```bash
aidlc version
# aidlc 2.11.4 (runtime 2.11.4)
```

### 3. プロジェクトに AI-DLC を設定
```bash
# まずドライランで確認
aidlc config --harness claude --mcp defaults --yes --dry-run
# Config plan for ...: create=399 update=0 merge=0 preserve=0 remove=0 conflict=0

# 実行
aidlc config --harness claude --mcp defaults --yes
# configured ... for Claude Code 2.11.4; next: open Claude Code in this project
# (if it is already open in this folder, exit it and start it again) and run `/aidlc --doctor`
```
> 対話形式で選びたい場合は `aidlc config` だけを実行する（ウィザードが起動、Enter で推奨値）。

### 4. 診断
```bash
aidlc doctor
```
```
Machine                 ok  all 11 checks passed
Project (.claude, Claude Code)
  warn  Workspace records: 8 uncommitted change(s) under aidlc/
  ok    46 checks passed
Framework integrity     ok  all 12 checks passed
0 problems, 1 warning.
```
警告は「`aidlc/` が未コミット」というだけなので、コミットすれば消える。

### 4.5 uv（uvx）を入れて AWS 系 MCP サーバを有効にする
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# downloading uv 0.13.9 ... installing to ~/.local/bin  uv  uvx
uvx --version
aidlc doctor
# Project (.claude, Claude Code)  ok  all 47 checks passed
# 0 problems, 0 warnings.  Your install is ready.
```

### 5. 生成物をコミット
```bash
git add .claude .gitignore .mcp.json aidlc
git commit -m "chore: set up AI-DLC 2.11.4 for Claude Code"
```

## 生成されたもの
| パス | 内容 |
|---|---|
| `.claude/CLAUDE.md` | AI-DLC の動作ルール |
| `.claude/agents/` | 14 エージェント定義 |
| `.claude/skills/` | `/aidlc` スキル |
| `.claude/hooks/`, `tools/`, `sensors/` | フック・決定的エンジン・センサー |
| `.claude/scopes/`, `rules/`, `knowledge/` | プロファイル定義、ルール、方法論ナレッジ |
| `.claude/settings.json` | フック等の設定。`AWS_AIDLC_DEFAULT_SCOPE=classic`（既定プロファイル） |
| `.mcp.json` | MCP サーバ: context7, aws-mcp, aws-pricing, aws-iac, aws-serverless |
| `aidlc/spaces/default/memory/` | プロジェクト・チーム・フェーズ別のルール（学習ループで育つ） |
| `.gitignore` | AI-DLC のローカル作業ファイルを除外するブロック |

- モデル・プロバイダの上書きはなく、Claude Code の既存設定がそのまま使われる。
- Bedrock を使いたい場合は `.claude/settings.local.json.example` を参考に `.claude/settings.local.json`（git 除外）を作る。

## ハマりどころ
- **ダウンロードしたスクリプトの実行は、AI エージェントの自動許可モードではブロックされることがある。** `curl ... | sh` は自分の端末で実行する（Claude Code 内なら `! コマンド` で実行できる）。
- **`/aidlc` はすぐには使えない。** スキルは Claude Code の起動時に読み込まれるため、`aidlc config` の後は Claude Code を一度終了し、プロジェクトフォルダで起動し直す。
- **AWS 系 MCP サーバには `uvx`（uv）が必要。** 無くてもワークフローは止まらないが、AWS の料金や IaC の情報を AI が参照できなくなる。`curl -LsSf https://astral.sh/uv/install.sh | sh` で導入し、AWS 認証情報（`aws configure`）を用意する。
- `context7` MCP は `CONTEXT7_API_KEY` が必要（任意）。
- ネット上の古い記事（2.7 以前）の `git checkout v2` → `cp -r dist/claude/...` 手順や Bun のインストールは不要。

## 次の章
Claude Code を再起動して:
```
/aidlc --doctor
/aidlc feature "タスク管理Webアプリを作り、GitHubで公開してAWSにデプロイする"
```
