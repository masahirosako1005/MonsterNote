# Security Design（セキュリティの設計）— U2 `u2-report-duplicate`

入力: `construction/u2-report-duplicate/nfr-requirements/security-requirements.md`（NFR4.6〜NFR6.4）、logical-components.md、`construction/u1-skeleton/nfr-design/security-design.md`（U1 の設計。ログイン・API の認可・データの保護をここで引き継ぐ）、`construction/u2-report-duplicate/functional-design/rules.md`（BR6.5・BR8.9・BR9.1）、`inception/contract-design/contract-summary.md`（2.1b）。

U1 のログイン・API の認可・CSP・秘密情報の決まりは、そのまま U2 の API にも適用する。ここには U2 で足す分だけを書く。

## 1. 外部のサービスへの認可

| ID | 設計 |
|---|---|
| NFR5.11 | Reporting の関数の IAM ロールに、Rekognition の `DetectLabels` を呼ぶ権限だけを付ける（リソースを絞れないため、アクションを `rekognition:DetectLabels` の 1 つに限定）。Rekognition への通信は AWS の内部ネットワークを通り、画像データはリクエストの中身として送る（別の保存場所には残さない） | NFR5、NFR6.4 |
| NFR6.4 | Rekognition のサービス側の学習への利用はオプトアウト設定を使う（Amazon の既定でカスタマーのデータは学習に使われないが、設定で明示する） | NFR6 |

## 2. 設定の読み出しの認可（NFR4.8、2.1b）

| 呼び出し元 | 証明の種類 | 許すか |
|---|---|---|
| Reporting（送信の前の対象地域の確認） | 利用者の証明（ハンターの JWT） | 許す |
| 画面（`GET /v1/report-settings`） | 利用者の証明 | 許す（対象地域だけを返す） |
| DuplicateDetection（保存のあとの再判定） | 部品の身元の証明（ADR-011。利用者がいない処理） | 許す（2.1b の表にある呼び出し） |
| それ以外 | — | 拒む（401・403） |

部品の身元の証明は、U1 の ADR-011 の仕組み（Lambda の直接の呼び出し＋呼び出す関数の IAM ロールを絞る）をそのまま使う。DuplicateDetection の IAM ロールには、Settings の関数を呼ぶ権限だけを付ける。

## 3. 重複の知らせでの情報の絞り込み（NFR5.7）

| ID | 設計 |
|---|---|
| NFR5.7 | 送信の前の問い合わせ（C9）と保存のあとの一覧（C5）のどちらも、DuplicateDetection が応答を組み立てるときに、相手の `species`・`capturedAt`・`distanceMeters`（100 m 単位に丸める）だけを選んで返す。`reportId`・`hunterAccountId` はここで**落とす**（応答の組み立てのコードが、許された 3 つの項目だけを持つ型を返す形にし、元のデータを持つオブジェクトをそのまま返さない） | NFR5、BR7.3 |
| NFR5.8 | `ReportFootprint`・`DuplicateSuspicion` の表には、氏名・写真の参照を持たせない（entities.md の形のとおり）。表の形そのものが、漏らしてはいけない項目を持たない作りにする | NFR5 |

## 4. ログと記録

| ID | 設計 |
|---|---|
| NFR5.10 | 共通のロガーの「出してよい項目」の一覧（U1 の NFR5.5 の実装）に、新しく出してはいけない項目（緯度・経度、保存場所のキー、生のラベル）を加える。ロガーの型の定義で、これらの項目を受け取らないようにする（コードの検査で防ぐ） | NFR5 |
| NFR5.12 | 地図のタイルの取得は画面（ブラウザ）から直接行い、サーバーを経由しない。報告の捕獲場所の値をタイルの URL に含めない（表示する範囲のタイル座標だけを渡す） | NFR5 |

## Assumptions & Open Questions

- Rekognition のオプトアウト設定（NFR6.4）は、Infrastructure Design で IAM ポリシーかサービスの設定として具体化する。 [assumption]
