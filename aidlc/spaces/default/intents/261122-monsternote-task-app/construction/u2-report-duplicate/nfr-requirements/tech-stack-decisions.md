# Tech Stack Decisions（技術の選択）— U2 `u2-report-duplicate`

入力: `construction/u1-skeleton/nfr-requirements/tech-stack-decisions.md`（U1 で決めた技術の選択。**U2〜U4 も同じ**と明記されている）、`construction/u2-report-duplicate/functional-design/`（functional-spec・rules・frontend-components）、nfr-requirements-questions.md（Q1〜Q6）、`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`、project.md。

U1 で決めた技術（TypeScript・Lambda Node.js 22 Arm・API Gateway HTTP API・DynamoDB・Cognito・S3・React ＋ MUI ＋ Vite・CDK・Vitest ＋ Playwright）は **U2 でもそのまま使う**。ここには **U2 で新しく要るもの**だけを書く。

## 1. U2 で新しく選ぶもの

| 分野 | 選んだもの | 理由 | 選ばなかったもの | 出典 |
|---|---|---|---|---|
| 種類の自動判別 | **Amazon Rekognition の `DetectLabels`**（ラベルと確からしさを取り、クマ・イノシシ・シカに対応付ける） | 無料枠が月 5,000 枚（12 か月）。学習の用意が要らず、呼ぶだけで使える。AWS の権限（IAM ロール）で呼べて、鍵を持たない。**`technical-environment.md` の「使ってよいサービス」の表には載っていないため、同じ文書の「新しいサービスの承認の手順」（無料枠と想定月額を示して人の承認を得る）に従って承認を得た**（機能設計の Q6、NFR の Q2 で費用を示した。レビュー R-05） | 自前の機械学習の仕組み（Bedrock・SageMaker。常時課金または従量課金で、project.md の禁止と NFR1 に合わない） | technical-environment、NFR1、Q2 |
| 判別の結果の保存 | DynamoDB の表（`DetectionResult`）。写真と同じ 24 時間の自動削除（TTL） | 既存の選択と同じ。結び付かない写真の分を自動で消せる | 判別の結果を保存しない（FR3.4 が記録を求めている） | 機能設計の Q4・Q6 |
| 24 時間の自動削除 | **DynamoDB の TTL ＋ S3 のライフサイクル**（部品ごとに自分のデータを消す） | AWS が自動で行い、動かす処理が増えない（費用 0 円）。ADR-009 は「24 時間で消す仕組みは Functional Design・NFR Design で決める」としており、ここがその決定にあたる | 定期の処理（EventBridge Scheduler ＋ Lambda。関数が 1 つ増える） | 機能設計の Q4、ADR-009 |
| 重複の索引 | DynamoDB の表（`ReportFootprint`）。「種類＋捕獲日」を区分のキーにする | 「半径 1 km 以内」を直接引く機能がないため、日で絞ってから距離を計算する。索引を増やさない | ジオハッシュの索引（格子の境目の扱いが複雑）、全件を読む（費用が増える） | 機能設計の Q5 |
| 距離の計算 | 大円距離（ハバーサイン）を自分で計算する（地球の半径 6,371 km） | 数式が短く、外部のライブラリが要らない。試験で 1 m の誤差まで確かめられる | 地理計算のライブラリ（依存が増える） | FR6.2 |
| 写真の縮小と撮影情報の読み取り | ブラウザの機能（Canvas で縮小、EXIF を自分で読む） | 端末で縮小してから送る決まり（FR2.12）。外部のサービスを使わない | サーバー側で縮小（通信量と関数の時間が増える） | FR2.12、NFR9.3 |
| 地図の表示 | **OpenStreetMap のタイル ＋ 軽量の地図のライブラリ**（具体の選定は Code Generation） | 無料で使える。地名を求める API は使わない（機能設計の Q2） | Amazon Location Service（12 か月の無料枠のあとに課金）、Google Maps（有料） | 機能設計の Q2、NFR1 |

## 2. 約束（contract-summary）・ADR との違い

**約束の文書（`contracts/openapi.yaml`）は Code Generation で更新する。**

| # | 対象 | 変える点 | 理由 |
|---|---|---|---|
| D-1 | ADR-009 の「24 時間たっても結び付かない写真は、**Reporting が写真を消し、SpeciesDetection に判別の結果を消してもらう**」、約束 C8 の `DELETE /internal/v1/species-detections/by-photos`、contract-summary 2.1b のその道への部品の身元の証明の許可 | **部品ごとに自分のデータを自分で消す**（写真は Reporting の S3 と表の TTL、判別の結果は SpeciesDetection の表の TTL）。Reporting から SpeciesDetection へ消してもらう内部の道は**作らない** | ADR-009 は「24 時間で消す仕組みは Functional Design・NFR Design で決める」と明記しており、ここがその決定（機能設計の Q4 で人が選んだ）。AWS の自動削除に任せると、部品をまたぐ呼び出しも定期の処理も要らなくなる（費用 0 円、関数も増えない）。レビュー R-01 |

U4 の「すべて削除」で使う `/v1/admin/detection-data`（C17）は、この決定の影響を受けない（そちらは管理者の操作で、24 時間の自動削除とは別）。

**次のステージへの申し送り**（レビュー R-08）: 約束の文書（`contracts/openapi.yaml`）を直すのは Code Generation だが、**Infrastructure Design はそれより先に動く**。D-1 のとおり、`DELETE /internal/v1/species-detections/by-photos` の道と、contract-summary 2.1b のその道への部品の身元の証明は**作らない**。代わりに、写真の表と判別の結果の表に TTL を、写真の保存場所にライフサイクルの決まりを設定する。

## 3. U1 から引き継ぐ品質の要件

U1 の NFR13.1〜NFR13.4（行カバレッジ 80% 以上、TDD、CI、`npm run verify`）は U2 でもそのまま。U2 で足す試験の観点:

| ID | 要件 | 出典 |
|---|---|---|
| NFR13.5 | 判別のサービスは試験ではモックで置き換える（成功・確からしさ不足・失敗・時間切れの 4 通り）。本物のサービスを使う試験は `dev` でだけ行う | team-practices、NFR10.9 |
| NFR13.6 | 距離の計算は、FR6.2 の例（800 m・ちょうど 1,000 m・25 時間後・ちょうど 24 時間後・別の種類）をそのまま試験にする。誤差は 1 m まで許す | FR6.2、AC3.1.1〜AC3.1.5 |
| NFR13.7 | 24 時間の自動削除は、CDK の構成の試験（TTL とライフサイクルの設定）で確かめる。実際に消えることは `dev` で確かめる（24 時間待てないため、設定の確認までとする） | 機能設計の Q4、NFR12.7 |
| NFR13.8 | 判別の精度（FR3.5。3 種類それぞれ 10 枚以上で 70% 以上）は Build and Test で確かめ、結果を記録する | FR3.5 |

## Assumptions & Open Questions

- Rekognition のラベル（英語。`Bear`・`Pig`・`Boar`・`Deer` など）を、クマ・イノシシ・シカに対応付ける表は Code Generation で作る。イノシシは `Pig`・`Hog`・`Boar`・`Warthog` などに散ることがあり、複数のラベルをまとめる必要がある。 [assumption]
- 地図のライブラリ（Leaflet など）の選定と、OpenStreetMap のタイルの利用の条件（表示するクレジット、アクセスの頻度の制限）は Code Generation で確かめる。 [assumption]
- 判別の精度（NFR13.8）に使う写真をどこから用意するかは、Build and Test の前に決める必要がある（公開されている写真を使うか、試験運用の最初の報告を使うか）。 [assumption]
