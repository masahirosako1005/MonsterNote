# Constraint Register — MonsterNote

入力: `ideation/intent-capture/intent-statement.md`（intent-statement）、`ideation/market-research/`（competitive-analysis・market-trends・build-vs-buy）、feasibility-questions.md（Q1〜Q9）、`aidlc/spaces/default/memory/project.md`、`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`。

## 1. 技術の制約

| ID | 制約 | 出所 |
|---|---|---|
| C-T1 | AWS 東京リージョン（`ap-northeast-1`）。AWS CLI の `default` プロファイルを使う | project.md（Deployment） |
| C-T2 | フルサーバレス。常時起動・時間課金のリソース（EC2、RDS/Aurora、NAT Gateway、Fargate、ElastiCache、WAF、Route 53 ホストゾーン）は使わない | project.md（Forbidden） |
| C-T3 | API にはスロットリングを設定し、関数のメモリは 128〜256 MB、ログの保存期間は 14 日以内にする | project.md（Mandated） |
| C-T4 | フロントエンド・バックエンド・インフラの定義は TypeScript で統一する | technical-environment.md |
| C-T5 | 圏外対応は不要（電波のある場所で報告する） | Q6 |

## 2. 費用の制約

| ID | 制約 | 出所 |
|---|---|---|
| C-C1 | MonsterNote の AWS 費用は月 100 円以内（写真の自動判別を含む） | intent-statement（Success Metrics） |
| C-C2 | 費用は MonsterNote のタグ（`Name=masahiro-<サービス名>-monsternote`）で分け、請求コンソールのタグ別の表示で確認する | Q3、project.md（Deployment） |
| C-C3 | 新しい AWS リソースは、作る前に無料枠に収まるかを確認し、想定の月額を示す | project.md（Mandated） |
| C-C4 | アカウントの無料枠は作成から 12 か月以内の従来型。12 か月を過ぎると、一部のサービスで少額の費用がかかる | Q1 |

## 3. 組織・進め方の制約

| ID | 制約 | 出所 |
|---|---|---|
| C-O1 | 開発者 1 人＋AI エージェント | technical-environment.md |
| C-O2 | 最初の版は 1 か月以内に使える状態にする。範囲は Scope Definition で絞る | Q7・Q8 |
| C-O3 | AWS アカウントは別プロジェクト（mononoke）と共用。mononoke のリソースには触れない | project.md（Forbidden） |
| C-O4 | AWS へのデプロイ・削除は、実行する前に必ず人に確認する | project.md（Mandated） |
| C-O5 | 負荷試験で無料枠を超えない | project.md（Forbidden） |

## 4. 規制・制度の制約

| ID | 制約 | 出所 |
|---|---|---|
| C-R1 | 国の捕獲確認マニュアルの確認方法（位置付きの写真、個体へのマーキング、尻尾の写真）に合わせる | Market Research の Q3、market-trends |
| C-R2 | 国の交付金の実績報告に使える項目と写真を記録する | Market Research の Q8、market-trends |
| C-R3 | 捕獲従事者の番号をハンターごとに登録し、報告に付ける | Q5 |
| C-R4 | ハンターの氏名・位置などをお客様に見せるため、利用開始時にハンターから同意を得る | Q4・Q9 |

## 5. セキュリティの制約

| ID | 制約 | 出所 |
|---|---|---|
| C-S1 | GitHub リポジトリは公開。AWS の認証情報、`.env` ファイル、パスワードなどの秘密情報をコミットしない | project.md（Forbidden） |
| C-S2 | すべての API に認証を付け、利用者ごとに見られるデータを分ける（他人の報告を勝手に読み書きできない） | technical-environment.md |

## Assumptions & Open Questions

- 個人情報の扱い（同意の取り方・保存期間など）の法的な詳細は、後のステージで確認する。 [assumption]
