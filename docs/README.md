# AI-DLC2 実践教材ドキュメント

AWS の AI-DLC（AI-Driven Development Life Cycle）v2 を使い、端末環境のセットアップから
サンプルアプリの完成、GitHub 公開、AWS デプロイまでを記録する。各章は動画の1セクションに対応する。

## 目次

| 章 | ファイル | 内容 | 状態 |
|---|---|---|---|
| 00 | [00-research/ai-dlc2-overview.md](00-research/ai-dlc2-overview.md) | 公式情報の調査メモ | ✅ |
| 01 | `01-what-is-ai-dlc2.md` | AI-DLC2 とは（v1との違い、5フェーズ/33ステージ、エージェント、プロファイル） | ⬜ |
| 02 | `02-environment-setup.md` | 環境構築（WSL2, Claude Code, aidlc インストール, `aidlc config`, `aidlc doctor`） | ⬜ |
| 03 | `03-ideation.md` | Ideation（Intent Capture 〜 Approval & Handoff） | ⬜ |
| 04 | `04-inception.md` | Inception（要件・ストーリー・ドメイン設計・Unit 分割・Bolt 計画） | ⬜ |
| 05 | `05-construction.md` | Construction（Unit 毎の設計・コード生成・Build & Test・CI） | ⬜ |
| 06 | `06-github.md` | GitHub 公開（リポジトリ作成、GitHub Actions） | ⬜ |
| 07 | `07-operation-aws-deploy.md` | Operation / AWS デプロイ（CDK、デプロイ実行、監視） | ⬜ |
| 08 | `08-retrospective.md` | 振り返り（成果物ツアー、audit、コスト、Tips） | ⬜ |

## 各章の記録ルール
- 実行したコマンドと出力（要点）、`/aidlc` への入力と AI の質問・回答、承認ゲートでの判断を時系列で残す。
- スクリーンショットは `docs/images/NN-*.png` に保存して参照する。
- つまずいた点と解決策は章末の「ハマりどころ」にまとめる（動画の見どころになる）。

## 次に決めること
- サンプルアプリの題材
- ワークフロープロファイル（デプロイまで回すなら `feature` か `/aidlc compose`）
- LLM プロバイダ（Claude Code の現在の認証 or Amazon Bedrock）
- AWS 構成（例: CDK + Lambda / API Gateway / DynamoDB + S3 / CloudFront）とアカウント・リージョン
