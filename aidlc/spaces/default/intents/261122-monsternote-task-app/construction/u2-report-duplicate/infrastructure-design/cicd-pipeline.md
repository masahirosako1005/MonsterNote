# CI/CD Pipeline（ビルド・試験・デプロイの流れ）— U2 `u2-report-duplicate`

入力: `construction/u1-skeleton/infrastructure-design/cicd-pipeline.md`（U1 の流れ。そのまま使う）、infrastructure-specification.md、monitoring-design.md、`construction/u2-report-duplicate/nfr-requirements/tech-stack-decisions.md`（CI は AWS に接続しない、E2E は手元で実機の AWS を使う分を足す）。

U1 の流れ（手元の確認 → PR → CI → 取り込み → デプロイ前の確認 → デプロイ → スモーク → タグ）は変えない。U2 で足すのは、CI の中の試験内容と、デプロイ前の確認・スモークの中身。

## 1. CI（AWS に接続しない）での追加

| 対象 | 試験の内容 |
|---|---|
| 単体試験 | 種類の判別のしきい値判定（80%）、重複の距離・時間の計算（ハバーサイン）、DetectionRateLimit の条件式のロジック |
| 結合試験 | Rekognition は AWS SDK のモックで置き換える（実際には呼ばない）。DynamoDB Local で `DetectionResults`・`ReportFootprints`・`DuplicateSuspicions`・`Settings`・`DetectionRateLimits` の読み書きを確認する |
| E2E（AWS なし） | 判別結果をモックで返す画面の E2E、重複の疑いがある場合の確認ダイアログの E2E |
| CDK の構成の試験 | 新しい 5 つの表、2 つの新しい Lambda 関数のメモリ・時間切れ（`duplicate-detection` 256MB/10秒、`settings` 128MB/8秒）、`reporting` 関数の時間切れが 9 秒に変わっていること、S3 のライフサイクルルール（1 日）、IAM に `rekognition:DetectLabels` が含まれ他のアクションを含まないことを確認する |

## 2. デプロイ前の確認（更新）

U1 の「`cdk diff --all` の結果と費用の見込みを示す」に加え、以下を示す:
- Rekognition の無料枠が「デプロイから 12 か月」であることと、現在の見込み（月 150 回程度、無料枠内）
- OpenStreetMap のタイルサーバーへの直接アクセスを許可する CSP の変更内容

## 3. スモーク（U2 で足す手順）

U1 のスモーク（① 〜 ⑦）のあとに続けて行う:

| # | 内容 |
|---|---|
| 8 | 全身の写真を `POST /v1/photos` → 署名付き POST で送り、`complete` を呼ぶ。判別の結果（`detected`/`undetected`）が返ることを確認する |
| 9 | 試験用のハンターで、同じ種類・近い場所・近い時刻の報告を 2 件送る。2 件目の送信で重複の疑いの確認画面が出ることを確認する（送信前の問い合わせ、C9） |
| 10 | 確認のうえで送信し、`report.saved` の知らせのあと `duplicate.suspected` の知らせが届き、依頼元の一覧に重複の印が付くことを 10 秒以内に確認する |
| 11 | 地図の部品が開き、OpenStreetMap のタイルが表示されることを確認する（CSP でブロックされていないこと） |

試験用のアカウント・報告は、既存のスモーク用アカウント（`smoke-hunter`・`smoke-requester`）をそのまま使う。

## 4. 戻し方（U1 からの変更なし）

U1 と同じ手順（直前のタグに戻す、またはやり直す）。U2 で追加した表・関数は `MonsterNote-Data-dev`・`MonsterNote-Api-dev` の中にあり、スタックの構成自体は変わらないため、戻し方の手順に変更はない。

## Assumptions & Open Questions

- Rekognition の呼び出しを含む結合試験は CI では実行せず（モック使用）、dev へのデプロイ後のスモーク（#8）で初めて実際の Rekognition を呼ぶ。 [assumption]
