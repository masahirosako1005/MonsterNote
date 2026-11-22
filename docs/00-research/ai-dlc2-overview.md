# AI-DLC2（AI-DLC Workflows v2）調査メモ

> 調査日: 2026-11-23 ／ 対象バージョン: aidlc-workflows **2.11.4**（README バッジ時点）
> 動画「01 AI-DLC2 とは」章の台本素材。記述の根拠は末尾のソース一覧を参照。

---

## 1. AI-DLC とは

- **AI-DLC（AI-Driven Development Life Cycle）** は AWS が提唱する「AI 主導のソフトウェア開発ライフサイクル」。
- 公式説明: AI コーディングアシスタントを「構造化され、検証可能なソフトウェアデリバリーワークフロー」に変えるもの。「AI が提案・作業し、人間が各ゲートで承認する」ゲート型の方法論。
- 公式リポジトリ: <https://github.com/awslabs/aidlc-workflows>（ライセンス **MIT-0**）
- 公式ドキュメント: <https://awslabs.github.io/aidlc-workflows/>
- 仕様書: リポジトリ `assets/` に「AI-DLC Workflows 2.0 Specification」（PDF）

### 沿革

| 時期 | 出来事 |
|---|---|
| 2025-07 | AWS DevOps Blog で方法論を公開（Raja SP） |
| 2025-11 | v1 ワークフロー（ルールファイル方式）を OSS 化 |
| 2026-04-24 | v2 系 v0.1.0 |
| 2026-06-18 | v2.0.0 プレビュー（Reviewer 機構、Kiro IDE 対応） |
| 2026-09 頃 | 2.x 安定版（2.7.0 など） |
| 2.8.0〜 | インストール方式がネイティブインストーラ（`install.sh` + `aidlc` コマンド）に変更 |
| 2026-11 | 2.11.4 |

## 2. v1 と v2 の違い

本質: **v1 は LLM が「次に何をするか」の判断も「作業」も担当。v2 はコード（決定的エンジン）が次のステージを決め、LLM はステージ内の作業だけを担当する。**

| 観点 | v1 | v2 |
|---|---|---|
| 仕組み | `core-workflow.md` 等のルールファイルをハーネス設定にコピー | TypeScript 製ツール・フック・エージェント・スキル |
| ルーティング | LLM がルール文を読んで判断 | 決定的エンジン（orchestrator）＋ LLM |
| 状態管理 | なし | `aidlc-state.md` |
| 監査 | なし | 構造化された audit ログ |
| 品質 | 人間のみ | Sensors（リンタ等・助言のみ）＋ Reviewer エージェント＋人間ゲート |
| 学習 | なし | 学習ループ（修正指示がルールとして蓄積） |
| 並列構築 | なし | Swarm（git worktree で Unit を並列構築） |
| 再開 | なし | チェックポイント再開・やり直し・ジャンプ |

## 3. 構造：5フェーズ / 33ステージ

Initialization 以外で実行される全ステージは最後に **承認ゲート**（`Approve` / `Request Changes`）で止まる。
フェーズ境界（Ideation→Inception→Construction→Operation）では自動検証ゲートも走る。

### Phase 0: Initialization（ゲートなし・自動）
| # | ステージ | 成果物 |
|---|---|---|
| 0.1 | Workspace Scaffold | `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` |
| 0.2 | Workspace Detection | greenfield / brownfield 判定 |
| 0.3 | State Initialization | `aidlc-state.md`, `audit/` |

### Phase 1: Ideation（何を・なぜ作るか）
| # | ステージ | 成果物 | 条件 |
|---|---|---|---|
| 1.1 | Intent Capture & Framing | Intent ステートメント、ステークホルダーマップ | 常に |
| 1.2 | Market Research | 競合分析、build-vs-buy | 条件付き |
| 1.3 | Feasibility & Constraints | 実現性評価、制約、RAID ログ | 条件付き |
| 1.4 | Scope Definition | スコープ定義、Intent バックログ | 常に |
| 1.5 | Team Formation | チーム評価、Mob 編成計画 | 条件付き |
| 1.6 | Rough Mockups | ワイヤーフレーム、ユーザーフロー | 条件付き |
| 1.7 | Approval & Handoff | イニシアチブブリーフ、決定ログ | 常に |

### Phase 2: Inception（要件・設計）
| # | ステージ | 成果物 | 条件 |
|---|---|---|---|
| 2.1 | Reverse Engineering | 既存コード解析 | brownfield のみ |
| 2.2 | Practices Discovery | `team-practices.md` 等 | 条件付き |
| 2.3 | Requirements Analysis | `requirements.md` | 常に |
| 2.4 | User Stories | `stories.md`, `personas.md` | ユーザー向け機能 |
| 2.5 | Refined Mockups | 高精度モック、インタラクション仕様 | UI あり |
| 2.6 | Domain Design | `components.md`, `decisions.md`（ADR） | 計画による |
| 2.7 | Units Generation | `unit-of-work.md` ほか | 常に |
| 2.8 | Contract Design | `contract-summary.md` | 条件付き |
| 2.9 | Delivery Planning | `bolt-plan.md` ほか | 常に |

### Phase 3: Construction（Unit ごとに反復）
| # | ステージ | 成果物 | 条件 |
|---|---|---|---|
| 3.1 | Functional Design | `entities.md`, `rules.md`, `functional-spec.md` | Unit 毎・条件付き |
| 3.2 | NFR Requirements | 性能・セキュリティ等の非機能要件 | Unit 毎・条件付き |
| 3.3 | NFR Design | 非機能設計 | Unit 毎・条件付き |
| 3.4 | Infrastructure Design | インフラ仕様、IaC 設計 | Unit 毎・条件付き |
| 3.5 | Code Generation | アプリケーションコード | Unit 毎・常に |
| 3.6 | Build and Test | テスト結果、品質レポート | 最後に1回 |
| 3.7 | CI Pipeline | CI 設定、品質ゲート | 条件付き・1回 |

### Phase 4: Operation（デプロイ・運用）※すべて条件付き
| # | ステージ | 成果物 |
|---|---|---|
| 4.1 | Deployment Pipeline | CD 設定、デプロイ戦略、ロールバック手順書 |
| 4.2 | Environment Provisioning | 環境一覧、検証レポート |
| 4.3 | Deployment Execution | デプロイログ、スモークテスト、ヘルスチェック |
| 4.4 | Observability Setup | ダッシュボード、アラーム、SLO |
| 4.5 | Incident Response | SSM ランブック、インシデント計画 |
| 4.6 | Performance Validation | 負荷試験結果 |
| 4.7 | Feedback & Optimization | SLO レポート、コスト分析 |

## 4. エージェント（14体）

- **ドメイン専門家 11体**: Product / Design / Delivery / Architect / AWS Platform / Compliance / DevSecOps / Developer / Quality / Pipeline & Deploy / Operations
- **Reviewer 2体**: 各ステージの主要ドキュメントをレビュー（助言）
- **Composer 1体**: 作業内容に合わせてステージ構成を組み立てる

AWS デプロイ関連:
- **AWS Platform Agent**: AWS サービス選定、CDK/CloudFormation テンプレート、コスト見積り（3.4, 4.2 を主導）。「全リソースはコードで定義。コンソール変更はドリフト」。
- **Pipeline & Deploy Agent**: CI/CD とリリース（3.7, 4.1, 4.3 を主導）。Bash でデプロイスクリプトやスモークテストを実行。
- 具体的な CI ツール（GitHub Actions 等）は公式に固定されていない → プロジェクト側で指定する。

## 5. ワークフロープロファイル（11種）

`/aidlc <profile>` で指定（例: `/aidlc mvp`）。説明文だけ渡せば自動判定。`/aidlc compose "<task>"` でカスタム構成。

| プロファイル | ステージ数 | 用途 |
|---|---|---|
| `classic` | 15 | v1 風。Inception〜Build and Test。暗黙のデフォルト |
| `express` | 7 | 要件が明確。最短でコード＋テスト（任意でデプロイ） |
| `feature` | 30 | 本番機能。フルライフサイクル |
| `enterprise` | 30 | 規制・高リスク・監査対応 |
| `mvp` | 20 | 最初のプロダクト増分。Operation なし |
| `poc` | 5 | 実現可能性の検証 |
| `bugfix` | 6 | 既知バグ修正＋回帰テスト |
| `refactor` | 7 | 振る舞いを変えない構造改善 |
| `infra` | 12 | 環境・IaC・デプロイ基盤・コスト |
| `security-patch` | 7 | CVE 対応 |
| `workshop` | 23 | 研修・グループセッション |

> **重要**: `classic`・`mvp`・`poc` は Operation フェーズ（デプロイ）を実行しない。
> AWS デプロイまで AI-DLC で回すには `feature`、`/aidlc compose`、または mvp 完了後に `infra` を別 Intent として実行する。

## 6. 対応ハーネス

| ハーネス | `aidlc config --harness` | 起動 |
|---|---|---|
| Claude Code | `claude` | `/aidlc` |
| Kiro IDE / Kiro CLI v3 | `kiro` | `/aidlc` |
| Kiro CLI v2 | `kiro-v2` | `/aidlc` |
| Codex CLI | `codex` | `$aidlc` |
| Cursor | `cursor` | `/aidlc` |
| opencode | `opencode` | `/aidlc` |
| GitHub Copilot CLI / VS Code | `copilot` | `/aidlc` |

## 7. Claude Code へのセットアップ（2.8 以降の現行手順）

前提: Claude Code がインストール済み・ログイン済み。**Bun / Node.js は不要**（ネイティブインストーラが同梱）。

```bash
# 1. aidlc コマンドをインストール（macOS / Linux / WSL）
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
#   PATH 追加を促されたら表示された export 行を実行（例: export PATH="$HOME/.local/bin:$PATH"）
aidlc version

# 2. プロジェクトに設定
cd /path/to/your-project
aidlc config --harness claude          # 対話ウィザードは `aidlc config`、非対話は --mcp defaults --yes
aidlc doctor

# 3. Claude Code で開始
claude
#   > /aidlc --doctor
#   > /aidlc "作りたいものの説明"
```

Windows PowerShell: `irm https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.ps1 | iex`

### 生成されるファイル
| パス | 内容 | git |
|---|---|---|
| `.claude/` | `/aidlc` スキル、エージェント、ステージ、フック、ツール、`settings.json` | コミット |
| `aidlc/` | 作業記録（`aidlc/spaces/default/memory/` にルール） | コミット |
| `.mcp.json` | MCP サーバ設定 | コミット |
| `aidlc.settings.json` | モデルプリセット | コミット |
| `.gitignore` | AI-DLC ブロック追記 | コミット |
| `aidlc.settings.local.json`, `.claude/settings.local.json` | 個人設定 | 除外 |

作業ごとの記録: `aidlc/spaces/default/intents/<YYMMDD-label>/`
（`aidlc-state.md`, `audit/`, `ideation/intent-capture/intent-statement.md`, `reviews/review-01.md` など）

### 実行の流れ
1. `/aidlc "説明"` → AI-DLC がプラン（例: mvp・19ステージ）を提案。承認・変更・カスタム依頼が可能。
2. 回答モードを選択: 「Guide me」/「I'll edit the file」/「Chat」
3. 質問に答える → エージェントがドキュメント作成 → Reviewer がレビュー
4. ゲートで **Approve** か **Request Changes** → 「N of 19 stages done」と進捗表示

### 主な `/aidlc` コマンド
- 開始: `/aidlc [scope]`, `/aidlc [description]`, `/aidlc compose "<task>"`, `/aidlc park`
- 状態: `/aidlc --status`, `/aidlc --doctor`, `/aidlc --config`, `/aidlc --version`, `/aidlc --help`
- 制御: `/aidlc --stage <slug|#>`, `/aidlc --phase <name|#>`, `/aidlc --scope <name>`, `/aidlc --depth <level>`
- Intent/Space: `/aidlc intent [name]`, `/aidlc space [name]`
- 更新: `aidlc update` → `aidlc doctor` → `aidlc config`

### LLM プロバイダ / AWS
- AWS は必須ではない。Claude Code に設定済みのプロバイダ（Anthropic 認証）をそのまま使う。
- Bedrock を使う場合: Bedrock で Anthropic モデルを有効化、`aws configure` / `aws sso login`、`aidlc config providers --check`（`CLAUDE_CODE_USE_BEDROCK`, `AWS_REGION` が `.claude/settings.local.json` に書かれる）。
- AWS MCP サーバ 4種は `uvx` と AWS 認証情報が必要（無くてもワークフローは止まらない）。`context7` は `CONTEXT7_API_KEY` が必要。
- 推奨モデル: README は Claude Opus 4.8。弱いモデルは任意ステップの省略やゲートの早送りをしがち。

### 注意：旧版の情報
ネット記事には 2.7 以前の手順（`git checkout v2` → `cp -r dist/claude/.claude/ ...`、Bun 必須、`aidlc-docs/` ディレクトリ）が残っている。**現行版とは異なるため教材では使わない。**

## 8. 未確認事項（要追加調査）
- 原典の方法論用語（Intent / Unit / Bolt / Mob Elaboration / Mob Construction）の正式定義
  → `guide/03-spaces-and-intents/`, `guide/glossary/`, AWS ブログ本文をブラウザで確認
- `/aidlc` 実行時の実際の画面、所要時間、トークン/コスト

## ソース
- GitHub: <https://github.com/awslabs/aidlc-workflows>
- README: <https://raw.githubusercontent.com/awslabs/aidlc-workflows/main/README.md>
- Getting Started: <https://awslabs.github.io/aidlc-workflows/guide/01-getting-started/>
- Phases and Stages: <https://awslabs.github.io/aidlc-workflows/guide/04-phases-and-stages/>
- Workflow Profiles: <https://awslabs.github.io/aidlc-workflows/guide/workflow-profiles/>
- CLI Commands: <https://awslabs.github.io/aidlc-workflows/guide/12-cli-commands/>
- AWS Platform Agent: <https://awslabs.github.io/aidlc-workflows/guide/agents/aws-platform-agent/>
- Pipeline & Deploy Agent: <https://awslabs.github.io/aidlc-workflows/guide/agents/pipeline-deploy-agent/>
- AI-DLC v2 Core Concepts（AWS Builder Center）: <https://builder.aws.com/content/3GnQs6zaYp4mAx9FWBulDkhWnBo/ai-dlc-v2-core-concepts>
- v2 Claude Code クイックスタート（AWS Builder Center, 〜2.7）: <https://builder.aws.com/content/3HTM8fy03i3KDJkfX7hilYrFM3D/ai-dlc-workflow-v2claude-codequick-start>
- v2.8+ 手順（AWS Builder Center）: <https://builder.aws.com/content/3J4MLXQLoUAw8XYuYRrFoy6y32x/ai-dlc-workflow-v2-cp>
- Classmethod（v2 プレビュー導入記）: <https://dev.classmethod.jp/ja/articles/aidlc-workflows-v2-install-kiro-claude-codex/>
