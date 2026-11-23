# Security Design（セキュリティの設計）— U1 `u1-skeleton`

入力: `construction/u1-skeleton/nfr-requirements/security-requirements.md`（NFR4・NFR5・NFR6）、logical-components.md、`inception/domain-design/decisions.md`（ADR-007・ADR-011）、`inception/contract-design/contract-summary.md`（2.1・2.1b）、nfr-design-questions.md（Q2〜Q5）。

## 1. ログインと証明

| ID | 設計 |
|---|---|
| NFR4.1 | Cognito のユーザープール。自分での登録を無効（管理者だけがユーザーを作る）。アプリのクライアントは秘密の値なし（ブラウザ用）、認証の方式は ID とパスワード（SRP）。ID トークン・アクセストークン 1 時間、リフレッシュトークン 30 日。役割は Cognito のグループ（hunter・requester・admin）で持ち、ID トークンの `cognito:groups` に入る |
| NFR4.5 | パスワードの規則: 8 文字以上、英字（小文字）と数字を必須。記号・大文字は求めない（高齢の利用者への配慮）。失敗が続いたときは Cognito の標準の締め出しに任せる |
| （出し直し用の値の保存場所） | 画面は、リフレッシュトークンを localStorage に保存する（Q3）。ID トークンとアクセストークンはメモリだけに持つ。ログアウトで `DELETE /v1/session` を呼び（Accounts の関数が Cognito のトークンの取り消し〈RevokeToken〉を行う）、localStorage から消す |
| （ログインの道。約束 C1 のとおり） | `POST /v1/session`・`POST /v1/session/refresh`・`DELETE /v1/session` は約束（contract-summary C1）どおり API に作り、Accounts の関数が Cognito を呼ぶ（InitiateAuth の USER_PASSWORD_AUTH・REFRESH_TOKEN_AUTH、RevokeToken）。Accounts の関数は、ログインの応答に Account の表から mustChangePassword・consentRequired・hunterNumberRequired を加えて返す。画面は Cognito を直接呼ばない（レビューの指摘） |
| （30 日の延長） | Cognito のリフレッシュトークンの更新（refresh token rotation）を有効にする。出し直しのたびに新しいリフレッシュトークン（30 日）が発行され、古いものは使えなくなる。これで「最後の利用から 30 日」（約束 C1、FR1.6）を満たす。無効にしたアカウント（Cognito で無効化）には出し直しが失敗し 401 |

## 2. API の認可

| ID | 設計 |
|---|---|
| NFR4.2 | HTTP API の JWT オーソライザー（Cognito のユーザープールとアプリのクライアントを指定）を、`POST /v1/session` と `POST /v1/session/refresh` 以外のすべての道に付ける（`DELETE /v1/session` には付ける）。この 2 つの道は Accounts の関数が Cognito で ID とパスワード、または出し直し用の値を確かめる。証明のない呼び出しは API Gateway が 401 を返し、関数は動かない |
| NFR4.3 | 各関数の入口で、証明の `sub`（利用者の ID）と `cognito:groups`（役割）を読み、道ごとの許す役割と、データの持ち主（hunterAccountId）を確かめる。共通の処理（認可のヘルパー）にまとめ、すべての関数で使う。単体試験で、ハンターが承認の道・他人の報告を呼ぶと 403 になることを確かめる |
| NFR4.4 | 部品の間の呼び出し（C10 Reporting → Accounts）は、API Gateway を通さず Lambda の直接の呼び出し。Reporting の関数の IAM の役割に、Accounts の関数を呼ぶ権限だけを与える（部品の身元の証明。ADR-011）。呼び出しの中身に利用者の `sub` と役割を入れ、Accounts の関数も確かめる。外の API の入口には内部の道を作らない |
| （知らせの受け口） | EventBridge のルールは、送り手（source）が MonsterNote の部品のものだけを受け手の関数に配る。受け手の関数は EventBridge からの呼び出しだけを許す（関数の resource policy）。外から知らせを送り込む道はない |

## 3. データの保護

| ID | 設計 |
|---|---|
| NFR5.1 | API Gateway は HTTPS だけ（HTTP API は HTTPS だけを受ける）。TLS 1.2 以上。CloudFront は ViewerProtocolPolicy を「HTTP を HTTPS に転送」にする。CloudFront の既定のドメイン（`*.cloudfront.net`）では TLS の最低の版を設定できないため、既定に任せる（受け入れたリスク。独自のドメインは Route 53 のホストゾーンが禁止のため使えない。Q4） |
| NFR5.2 | S3（写真・画面）は SSE-S3、DynamoDB は既定の暗号化（AWS 所有の鍵） |
| NFR5.3 | 写真の S3 はパブリックアクセスのブロックをすべて有効。アップロードは署名付きの POST（presigned POST）にし、ポリシーの条件で、決まったキー（`photos/<accountId>/<photoId>`）・内容の種類・大きさの上限（content-length-range 1〜15 MB）・期限 5 分を S3 が強制する（PUT の URL では大きさを強制できないため。レビューの指摘）。さらにアップロードの完了の確認（BR2.9）で実物の大きさと形式を確かめ、違えば消す。表示用の URL は GET だけ・15 分 |
| NFR5.4 | 画面の S3 は Origin Access Control で CloudFront からだけ読める。S3 のウェブサイトの機能は使わない |
| NFR5.5 | ログの出力は共通のロガーを通し、氏名・位置・従事者番号・トークン・URL の項目を出さない（出してよい項目の一覧だけを出す形）。単体試験で確かめる |
| NFR5.6 | 画面は React の標準の表示を使い、`dangerouslySetInnerHTML` を ESLint の規則で禁止する |

## 4. 画面のセキュリティのヘッダーと CORS（Q5）

CloudFront のレスポンスヘッダーのポリシーで付ける（追加の費用なし）。

| ヘッダー | 値 |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://<写真の S3>; connect-src 'self' https://<API> https://cognito-idp.ap-northeast-1.amazonaws.com https://<写真の S3>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`（MUI のスタイルのため style だけ inline を許す） |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |

CORS: HTTP API の CORS の設定で、許す Origin をハンター用と依頼元用の CloudFront の URL の 2 つだけにする。許すメソッドは GET・POST・PUT・DELETE、許すヘッダーは Authorization・Content-Type。写真の S3 の CORS は、PUT と GET を同じ 2 つの Origin からだけ許す。

## 5. 秘密情報

| ID | 設計 |
|---|---|
| NFR6.1 | `.gitignore` に `.env*`・`cdk.out`・`*.pem` を入れる。GitHub のシークレットの検出とプッシュの保護を有効にする |
| NFR6.2 | 関数の環境変数は、表の名前・バスの名前・ユーザープールの ID など秘密でない値だけ。CDK が入れる |
| NFR6.3 | アカウントを作るスクリプトは手元の default のプロファイルで Cognito の AdminCreateUser を呼び、仮のパスワードを標準出力に 1 回だけ出す（ファイル・ログに残さない） |

## 6. 受け入れたリスク

| リスク | 理由 | 手当て |
|---|---|---|
| CloudFront の TLS の最低の版を決められない | 独自のドメインが使えない（Route 53 の禁止） | HTTPS への転送、HSTS |
| リフレッシュトークンを localStorage に置く | 30 日のログインの保持（FR1.6） | 厳しい CSP（自分のスクリプトだけ）、ログアウトでの取り消し |
| 無効にしたアカウントが最大 1 時間使える | 証明の期限（requirements A-8） | 出し直しで拒否 |

## Assumptions & Open Questions

- CSP の具体の URL（API・写真の S3）は Infrastructure Design・Code Generation で、CDK が作った値から入れる。 [assumption]
