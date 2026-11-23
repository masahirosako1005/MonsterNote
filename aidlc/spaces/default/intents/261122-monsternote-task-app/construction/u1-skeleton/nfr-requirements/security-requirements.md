# Security Requirements（セキュリティの要件）— U1 `u1-skeleton`

入力: `inception/requirements-analysis/requirements.md`（NFR4・NFR5・NFR6）、`inception/domain-design/decisions.md`（ADR-007 ログインの証明、ADR-011 部品の身元の証明）、`inception/contract-design/contract-summary.md`（C1・C16、2.1・2.1b）、`construction/u1-skeleton/functional-design/rules.md`（BR1・BR2.3・BR2.8・BR3.2・BR3.5・BR6.1）、nfr-requirements-questions.md（Q3〜Q5）、project.md（秘密情報、公開リポジトリ）。

## 1. 認証と認可

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR4.1 | ログインは Cognito のユーザープールで行う。管理者がユーザーを作り、自分での登録はできない設定にする。証明（ID トークン・アクセストークン）の期限は 1 時間、出し直し用の値（リフレッシュトークン）は 30 日 | CDK の構成の試験（assertions）で設定値を確かめる | NFR4、Q3、FR1.6 |
| NFR4.2 | API の入口（HTTP API）で、`POST /v1/session`・`POST /v1/session/refresh` 以外のすべての道に Cognito の証明の確認を付ける。証明のない呼び出しは 401 | CDK の構成の試験、E2E | NFR4、BR1.4 |
| NFR4.3 | 役割（hunter・requester・admin）は Cognito のグループで持ち、証明に入れる。各関数は呼ばれるたびに役割と持ち主を確かめる（画面で隠すだけにしない） | 単体試験（ハンターが承認の API・他人の報告を呼ぶと 403） | NFR4、BR1.2・BR2.8・BR3.2・BR3.5 |
| NFR4.4 | 部品の間の内部の道（`/internal/...`）は外の API の入口に出さない。部品の身元の証明（2.1b）の具体は NFR Design で決める | CDK の構成の試験（外の入口に `/internal` の道がない） | NFR4、ADR-011 |
| NFR4.5 | パスワードの規則は 8 文字以上・英字と数字を含む（Cognito のパスワードの規則で設定）。ログインの失敗が続いたときは Cognito の標準の保護（一時的な締め出し）に任せる | CDK の構成の試験 | FR1.8 |

## 2. データの保護

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR5.1 | 通信は HTTPS だけ（CloudFront は HTTP を HTTPS に転送、API Gateway は HTTPS だけ）。TLS 1.2 以上 | CDK の構成の試験 | NFR5 |
| NFR5.2 | 保存するデータは暗号化する: S3 は既定の暗号化（SSE-S3）、DynamoDB は既定の暗号化（AWS 所有の鍵。追加の費用なし） | CDK の構成の試験 | NFR5 |
| NFR5.3 | 写真の保存場所（S3）は公開しない（パブリックアクセスのブロックをすべて有効）。写真の読み書きは期限付きの URL だけ（アップロード 5 分、表示 15 分） | CDK の構成の試験、単体試験 | NFR5、BR2.2・BR6.1 |
| NFR5.4 | 画面の公開用の S3 は CloudFront からだけ読める（Origin Access Control）。直接の URL では読めない | CDK の構成の試験 | NFR5、Q5 |
| NFR5.5 | ログに氏名・位置（緯度・経度）・従事者番号・証明・写真の URL を出さない | 単体試験（ログの出力に含まれないこと） | NFR5、Q6 |
| NFR5.6 | 画面は、受け取ったデータを HTML として解釈せずに表示する（React の標準の表示を使い、HTML をそのまま差し込まない） | コードの検査（ESLint の規則） | NFR5 |

## 3. 秘密情報

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR6.1 | AWS の認証情報・パスワード・`.env` ファイルをリポジトリに置かない。`.gitignore` で除外し、GitHub のシークレットの検出を有効にする | PR の前の差分の確認、GitHub の設定 | NFR6、project.md |
| NFR6.2 | 関数が使う設定（表の名前、ユーザープールの ID など）は、CDK が関数の環境変数に入れる（秘密ではない値だけ）。秘密の値は U1 にはない | CDK の構成の試験 | NFR6 |
| NFR6.3 | アカウントを作るスクリプトは、開発者の手元の AWS の認証情報（default のプロファイル）を使い、仮のパスワードを画面に 1 回だけ表示する（ファイルに書かない） | スクリプトの試験 | NFR6、BR5.1 |

## 4. 脅威の考慮

| 脅威 | 手当て |
|---|---|
| 他人の報告を読む・承認する（権限の取り違え） | NFR4.3 |
| 他人の写真の ID を自分の報告に使う | BR2.3（写真の持ち主の確認） |
| 写真の URL の流出 | 表示用 URL の期限 15 分（NFR5.3） |
| 大量の呼び出しで費用が増える | API の流量の制限（scalability-requirements の NFR12.1） |
| 偽の知らせで確認中の記録を作る | 知らせの受け口を外に出さない（NFR4.4、NFR Design） |

## Assumptions & Open Questions

- 出し直し用の値を画面のどこに保存するか（ブラウザの保存場所の選び方）は NFR Design で決める（contract-summary の未解決の点）。 [assumption]
