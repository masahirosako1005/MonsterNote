# NFR Design — 質問（U1 `u1-skeleton`）

前提: `construction/u1-skeleton/nfr-requirements/`（NFR の詳細と技術の選択。レビューの残り: CloudFront の TLS、CORS・セキュリティのヘッダー、知らせの配達の失敗のアラーム）、`inception/domain-design/decisions.md`（ADR-008 知らせを確実に届ける方法は NFR Design、ADR-011 部品の身元の証明）、`inception/contract-design/contract-summary.md`（未解決の点）、project.md（無料枠、常時課金の禁止、Route 53 のホストゾーンの禁止）。

このステージでは、非機能の要件を満たすための仕組み（設計）を決めます。これまでのステージから持ち越した「知らせを確実に届ける方法」などを、ここで決めます。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 部品の間の知らせ（報告が保存された など）を、どうやって確実に届けますか？（ADR-008）

A. 保存と同じ書き込みで知らせを残す形にする。報告の表（DynamoDB）の変更を DynamoDB Streams で拾い、EventBridge（知らせの配り役）に送り、受け手ごとの SQS（待ち行列）に配る。受け手の処理が失敗したら 3 回までやり直し、それでも失敗した知らせは「失敗の置き場」（DLQ）に残す。保存したのに知らせが出ない、ということが起きない。費用は試験運用の規模で月 1 円未満
B. 保存のあとに、関数から直接 EventBridge に送る（簡単だが、送る前に関数が止まると知らせが失われる）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q2. [アーキテクト] 部品の間のその場の呼び出し（C8〜C11）と、部品の身元の証明（ADR-011）は、どうしますか？

A. 部品の間の呼び出しは API Gateway を通さず、関数から関数を直接呼ぶ（Lambda の呼び出し）。呼んでよい相手は AWS の権限（IAM）で関数ごとに限る（これが部品の身元の証明になる）。利用者の証明は呼び出しの中身に入れて渡し、呼ばれた側でも確かめる。外の API の入口には内部の道を出さない
B. 内部用に別の API Gateway を作り、AWS の権限の署名で呼ぶ
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] ログインの出し直し用の値（30 日）を、画面のどこに保存しますか？

A. ブラウザの保存場所（localStorage）に保存する。盗まれる危険（画面に悪いスクリプトが入り込む攻撃）は、厳しいセキュリティのヘッダー（CSP: 読み込んでよいスクリプトを自分のものだけに限る）で下げる。高齢のハンターが毎回ログインしなくて済む（FR1.6）
B. タブを閉じると消える保存場所（sessionStorage）。安全だが、30 日の保持ができない（FR1.6 を変えることになる）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] 画面の CloudFront の通信の暗号（TLS）の扱いは、どうしますか？（NFR Requirements のレビューの Major）

独自のドメインは Route 53 のホストゾーンが使えないため作れず、CloudFront の既定のドメイン（`*.cloudfront.net`）で公開します。既定のドメインでは、TLS の最低の版を自分で決められません。

A. CloudFront は HTTPS だけ（HTTP は HTTPS に転送）とし、TLS の最低の版は CloudFront の既定に任せる（これを受け入れたリスクとして記録する）。API Gateway は TLS 1.2 以上にする
B. 独自のドメインを使うため、Route 53 の禁止を見直す（月 0.5 ドル程度の費用がかかる）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] 画面と API の間の決まり（CORS）と、画面のセキュリティのヘッダーは、どうしますか？

A. API は、ハンター用と依頼元用の 2 つの CloudFront の URL からの呼び出しだけを許す（CORS）。CloudFront で、セキュリティのヘッダー（CSP、HSTS、X-Content-Type-Options、X-Frame-Options、Referrer-Policy）を付ける（追加の費用なし）
B. CORS はすべて許し、ヘッダーは付けない
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q6. [アーキテクト] 知らせの配達が失敗したことに、どう気づきますか？

A. 「失敗の置き場」（DLQ）に知らせが 1 件でも入ったら、メールで知らせる（3 つ目のアラーム。アラームは 10 個まで無料）。管理者が原因を直したら、置き場の知らせを手で戻して処理し直す（手順書を作る）
B. アラームは作らず、ログで確かめる
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

---

以下は、回答を読んで確認が必要になった点の追加質問です。

## Q7. [アーキテクト] 知らせの届け方と、承認済みの要件の食い違い（Q1・Q6）

Q1 で「保存のあとに関数から直接 EventBridge に送る」（B）、Q6 で「配達の失敗のアラームは作らない」（B）を選びました。一方、すでに作業を終えた U1 の設計と要件では、次のように決めています。
- Functional Design の BR2.7: 「保存した報告で知らせが送られないことがあってはならない」
- NFR Requirements の NFR10.3: 「保存した報告には必ず知らせが送られ、確認中の記録と一覧の行ができる」

B の方法では、保存のあと知らせを送る前に関数が止まると、その報告は承認も却下もできず、一覧にも出ません（ADR-008 の表）。アラームがないと、そのことに気づけません。

A. Q1・Q6 を変え、A にする（DynamoDB Streams → EventBridge → SQS、失敗の置き場とそのアラーム）
B. Q1・Q6 のとおり B にする。そのかわり、知らせを送れなかったときは関数が 3 回まで送り直し、それでも失敗したら送信を失敗（500）にして画面の「もう一度」に任せる（同じ送信のキーで送り直すと、保存済みの報告の知らせを送り直す）。BR2.7 と NFR10.3 を「送れなかったときは送信を失敗にする」と読み替えて記録する
C. Q1 は B、Q6 は A にする（EventBridge から受け手への配達の失敗だけを、失敗の置き場とアラームで拾う）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Consolidated Summary Confirmation

- 知らせの届け方: 報告を保存したあと、関数から直接 EventBridge に送る。送れなかったら関数が 3 回まで送り直し、それでも失敗したら送信を 500 で失敗にして、画面の「もう一度」（同じ送信のキー）に任せる。送り直しでは、保存済みの報告の知らせを送り直す。EventBridge から受け手の関数への配達は EventBridge の標準のやり直しに任せる。BR2.7 と NFR10.3 は「送れなかったときは送信を失敗にし、送り直しで必ず知らせる」と読み替えて記録する [Q1][Q6][Q7]
- 配達の失敗のアラーム: 作らない（ログで確かめる） [Q6][Q7]
- 部品の間の呼び出し: API Gateway を通さず関数から関数を直接呼ぶ。呼んでよい相手は IAM で関数ごとに限る（部品の身元の証明）。利用者の証明は中身に入れて渡し、呼ばれた側でも確かめる。外の入口に内部の道を出さない [Q2]
- 出し直し用の値: localStorage に保存し、厳しい CSP で盗まれる危険を下げる [Q3]
- CloudFront の TLS: HTTPS だけ（HTTP は転送）。最低の版は CloudFront の既定に任せ、受け入れたリスクとして記録する。API Gateway は TLS 1.2 以上 [Q4]
- CORS とヘッダー: API は 2 つの CloudFront の URL からだけ許す。CloudFront で CSP・HSTS・X-Content-Type-Options・X-Frame-Options・Referrer-Policy を付ける [Q5]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
