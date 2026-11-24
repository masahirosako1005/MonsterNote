# Infrastructure Specification（AWS の構成）— U2 `u2-report-duplicate`

入力: `construction/u2-report-duplicate/nfr-design/`（logical-components、performance・security・scalability・reliability・observability-design）、`construction/u2-report-duplicate/functional-design/functional-spec.md`（UC8〜UC14）、`inception/domain-design/components.md`、`construction/u1-skeleton/infrastructure-design/infrastructure-specification.md`（U1 の構成。ここに足す）、infrastructure-design-questions.md（Q1）。

U2 は、U1 がすでに作った 5 つのスタック（`MonsterNote-Auth-dev`・`Web`・`Data`・`Api`・`WebContent`）の構成を**そのまま使い**、新しいスタックは作らない。`Data`・`Api` の 2 つのスタックに、U2 の表・関数・外部サービスの接続を足す。

## 1. Deployment（U1 からの差分）

| Facet | Choice | Rationale |
|---|---|---|
| Resource sizing（更新） | Reporting の関数の時間切れを 8 秒 → **9 秒**に引き上げる（U2 の performance-design）。DuplicateDetection・Settings は新規で、それぞれ 256 MB・128 MB（NFR12.8） | performance-design §2 |
| 地図のタイル（Q1） | OpenStreetMap の公式タイルサーバーを画面から直接取得する。AWS のリソースは増えない。CloudFront のレスポンスヘッダーポリシー（CSP）の `img-src` に `https://*.tile.openstreetmap.org` を追加する | Q1-A |
| リージョン | Amazon Rekognition は `ap-northeast-1`（東京）で `DetectLabels` が利用可能なことを確認済み。新しいリージョンの選択は不要 | AWS のサービス一覧 |

## 2. Infrastructure Services（U2 で足すもの）

| Service | Role | Configuration | Notes |
|---|---|---|---|
| DynamoDB `DetectionResults` | データ | キー `photoId`。TTL 属性 `expiresAt`（結び付かなかった結果の自動削除。NFR11.7） | SpeciesDetection（Reporting の関数の中）だけ |
| DynamoDB `ReportFootprints` | データ | キー `reportId` | DuplicateDetection の関数だけ |
| DynamoDB `DuplicateSuspicions` | データ | キー `suspicionId`（`reportId#matchedReportId` の組み合わせで作る。BR8.9 の「同じ組は作り直さない」をキーの一意性で保証） | DuplicateDetection の関数だけ |
| DynamoDB `Settings` | データ | キー `settingKey`（1 行。初期値はデプロイ時のシード投入） | Settings の関数だけ |
| DynamoDB `DetectionRateLimits` | データ | キー `accountId#date`。TTL 属性 `ttl`（作成から 2 日後） | Reporting の関数だけ。scalability-design §1 |
| S3 写真（既存。更新） | 保存場所 | **ライフサイクルルールを追加**: オブジェクトの作成から 1 日で削除（scalability-design §3） | U1 の CORS・公開ブロックの設定は変えない |
| Lambda `reporting`（既存。更新） | 処理 | 時間切れ 8 秒 → 9 秒。IAM に `rekognition:DetectLabels`（リソースを絞れないため `*`。NFR5.11）を追加。`DetectionResults`・`DetectionRateLimits` への読み書き権限を追加。**Settings 関数への直接呼び出し権限（Lambda の `InvokeFunction`）。この呼び出しは利用者の証明〈ハンターの JWT〉をそのまま転送する呼び出しで、ADR-011 の部品の身元の証明ではない**（security-design.md §2、BR9.1。IAM の権限としては同じ Lambda 直接呼び出しだが、Settings 関数側が受け取る証明の種類が異なる） | SpeciesDetection のロジックはこの関数の中のモジュールとして実装（logical-components.md §3） |
| Lambda `duplicate-detection`（新規） | 処理 | 256 MB、時間切れ 10 秒（U1 の「知らせの受け手」の既定のまま。U2 では変更なし）。`ReportFootprints`・`DuplicateSuspicions` への読み書き権限。**Settings 関数への直接呼び出し権限（ADR-011 の部品の身元の証明。保存のあとの再判定は利用者がいない処理のため）** | API（送信前の問い合わせ）と知らせ（`report.saved`）の両方から呼ばれる（logical-components.md） |
| Lambda `settings`（新規） | 処理 | 128 MB、時間切れ 8 秒（U1 の「API の関数」の既定）。`Settings` の表への読み書き権限。**呼び出し元ごとに証明の種類を確認する**（Reporting からは利用者の証明〈ハンターの JWT〉を転送されたものとして検証し role=hunter 相当を確認、DuplicateDetection からは ADR-011 の部品の身元の証明として検証。security-design.md §2 の表のとおり） | API Gateway の道は持たず、Lambda の直接の呼び出しだけで受ける |
| Amazon Rekognition | 外部サービス | `DetectLabels` の呼び出しのみ。学習への利用のオプトアウト設定（NFR6.4）を IAM の条件キーまたはリクエストパラメータで明示 | Reporting の関数から呼ぶ |
| EventBridge（既存。ルール追加） | 知らせ | 新しいルール: `report.saved` → `duplicate-detection`（保存後の再判定）。送り手（source）で絞る既存の仕組みをそのまま使う | バスは U1 のものを共有 |
| API Gateway HTTP API（既存。道を追加） | 入口 | `POST /v1/photos/{id}/complete`（判別を含む）、`POST /v1/reports`（送信、重複の問い合わせを含む）、`GET /v1/report-settings`（画面向け、対象地域だけを返す）、**`GET /v1/duplicates/{reportId}`（依頼元だけが重複の疑いの相手の一覧を読める。約束 C5、BR8.9、role=requester の JWT オーソライザーの確認。担当は `duplicate-detection` 関数）**。`POST /internal/v1/duplicate-checks`（送信前の問い合わせ）は Reporting → DuplicateDetection の Lambda 直接呼び出しのため、この道は API Gateway には現れない | 既存の HTTP API に道を足すだけ |

## 3. Shared Infrastructure（U1 からの引き継ぎの確認）

U1 の表「Shared Infrastructure」のとおり、Cognito・HTTP API・EventBridge のバス・`MonsterNote-Data-dev` を U2 がそのまま利用する。U2 が新しく足す表・関数はすべて `MonsterNote-Data-dev`・`MonsterNote-Api-dev` の中に収まり、新しいスタックは作らない。

## 4. 新しいリソースの費用の見込み（project.md の Mandated）

| リソース | 使う量の見込み（試験運用の規模） | 無料枠 | 月額の見込み |
|---|---|---|---|
| DynamoDB（5 表追加） | 月 50 件未満の報告 × 数回の読み書き | 25 GB（常に無料） | 0 円 |
| Lambda（2 関数追加、既存 1 関数拡張） | 月 100 回未満の呼び出し | 月 100 万回（常に無料） | 0 円 |
| Amazon Rekognition（`DetectLabels`） | 月 150 枚程度（全身の写真）。5,000 回/月が 12 か月間無料 | 無料枠内（デプロイから 12 か月） | 0 円（12 か月後は 1,000 回あたり約 1 ドル。月 150 回なら 1 ドル未満） |
| OpenStreetMap のタイル（外部、AWS 外） | 画面からの直接取得 | AWS の課金対象外 | 0 円（AWS 請求には出ない） |
| S3 ライフサイクルルール | 既存の写真バケットの設定変更のみ | — | 0 円（削除自体は無料。ストレージ費用がむしろ減る） |
| **U2 の追加分の合計** | | | **月 1 ドル未満**（目標の月 100 円以内） |

Rekognition の無料枠（5,000 回/月）は「デプロイから 12 か月」であり、U1 の無料枠（多くが「常に無料」）と期限の性質が異なる点に注意する（運用の記録に残す）。

## Assumptions & Open Questions

- Rekognition の無料枠の 12 か月のカウント開始日は、AWS アカウント全体の初回利用日（またはサービスごとの初回呼び出し日）に依存する。正確な期限は AWS の請求コンソールで確認する。 [assumption]
- OpenStreetMap の公式タイルサーバーの利用方針は変更されることがあるため、デプロイ後も定期的に利用方針を確認し、問題が生じた場合は Q1-B（有料枠のある提供元）に切り替える。 [assumption]
