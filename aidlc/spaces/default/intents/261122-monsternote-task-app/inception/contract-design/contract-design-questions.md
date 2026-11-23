# Contract Design — 質問

前提: `inception/units-generation/unit-of-work.md`・`unit-of-work-dependency.md`（Unit 4 個、U2 と U3 は同時に作れる。つなぎ目の表）、`inception/domain-design/components.md`・`decisions.md`（部品 12 個、ADR-007 ログインの証明、ADR-008 知らせの届け方は NFR Design、ADR-011 部品の間の証明、ADR-012 保存の知らせの中身）、`inception/requirements-analysis/requirements.md`。

このステージでは、境目をまたぐ「約束」（契約）を決めます。約束とは、どんなデータを、どんな形で、どんな方法で渡し、失敗したらどうするか、です。約束が決まっていれば、U2 と U3 を同時に作っても、あとでつなげたときに食い違いません。

MonsterNote の境目は次の 2 種類です。
- **外との境目**: 3 つの画面アプリ（利用者のブラウザ）が呼ぶ API。インターネットから呼ばれる
- **部品の間の境目**: 部品どうしのその場の呼び出しと、知らせ（報告が保存された、状態が変わった など）

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 画面アプリが呼ぶ API の形は、どれにしますか？

A. REST（HTTPS で JSON をやり取りする、最も一般的な形）。1 つの API の入口の下に、部品ごとの道（`/reports`、`/reviews`、`/accounts` など）を並べる。仕様は OpenAPI という標準の書き方で書く
B. GraphQL（画面が必要な項目を指定して取り出す形）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 写真のアップロードは、どの道を通しますか？

写真は縮小後で 1 枚 1 MB 前後の見込みです（requirements FR2.12）。

A. API で「アップロード用の期限付きの URL」を発行し、ブラウザから写真の保存場所に直接送る。送り終わったら API に知らせる（API の容量の上限や料金にかかりにくく、一般的な方法）
B. API に写真のデータをそのまま送る（仕組みは単純だが、API の容量の上限に近づく）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] 部品の間の知らせ（イベント）の形は、どうしますか？

届け方（使う AWS のサービスや再送の仕組み）は NFR Design で決めます（ADR-008）。ここでは中身の形を決めます。

A. すべての知らせに共通の外側（知らせの ID、種類、版、起きた日時、操作した利用者の ID、送った部品）を付け、中身（data）は知らせの種類ごとに決める。同じ知らせが 2 回届くことがある前提で、受け手は知らせの ID で 2 回目を無視する。仕様は AsyncAPI という標準の書き方で書く
B. 知らせの種類ごとに自由な形にする（共通の外側は作らない）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] 約束（仕様）の持ち主と、置き場所はどうしますか？

A. 約束を提供する側の部品が持ち主になる（API は提供する部品、知らせは送る部品）。仕様のファイルはリポジトリの 1 か所（共通の約束の置き場）にまとめ、変えるときは PR で提供側と利用側の両方を確かめる
B. 各 Unit の中に、それぞれの仕様を置く
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] 約束を変えるときの決まり（版の上げ方）は、どうしますか？

AWS への配置は全体を一度に行います（Units Generation）。外の利用者は自分たちの 3 つの画面アプリだけです。

A. 項目を足すだけの変更は、いつでもしてよい（受け手は知らない項目を無視する）。項目を消す・意味を変える変更は、提供側と利用側を同じ PR で直し、知らせは版の番号を上げる。API の道に版（`/v1`）を付けるのは最初の版だけで、試験運用の間は `/v2` を作らない
B. 互換性のない変更をするたびに、API の版（`/v2`）を新しく作り、古い版も残す
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q6. [アーキテクト] エラー・時間切れ・やり直しの決まりは、どうしますか？

A. エラーは共通の形（`code`・`message`・`details`）で返し、HTTP の状態番号を使い分ける（400 入力の誤り、401 ログインが必要、403 権限がない、404 ない、409 すでに確認済み・二重送信、422 決まりに合わない〈7 日より前など〉、500 サーバーの誤り）。画面から API への呼び出しは 10 秒、部品の間のその場の呼び出しは 3 秒で時間切れ。報告の送信は「送信のキー」で何度送っても 1 件になるので、画面はやり直してよい。それ以外の書き込みは、画面が自動でやり直さない
B. エラーの形は部品ごとに自由にする
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 画面アプリが呼ぶ API: REST（HTTPS・JSON）。1 つの API の入口の下に部品ごとの道（`/v1/reports` など）を並べ、OpenAPI で書く [Q1]
- 写真のアップロード: API が期限付きのアップロード用 URL を発行し、ブラウザから写真の保存場所に直接送る。送り終わったら API に知らせる [Q2]
- 知らせ: 共通の外側（知らせの ID、種類、版、起きた日時、操作した利用者の ID、送った部品）と、種類ごとの中身。受け手は知らせの ID で 2 回目を無視する。AsyncAPI で書く [Q3]
- 持ち主と置き場所: 提供する側の部品が持ち主。仕様のファイルはリポジトリの 1 か所にまとめ、変更は PR で提供側と利用側の両方を確かめる [Q4]
- 変更の決まり: 項目を足すだけならいつでもよい（受け手は知らない項目を無視）。消す・意味を変えるときは同じ PR で両側を直し、知らせの版を上げる。API は `/v1` のみで、試験運用の間は `/v2` を作らない [Q5]
- エラー・時間切れ: 共通のエラーの形（code・message・details）と HTTP の状態番号の使い分け（400・401・403・404・409・422・500）。画面→API は 10 秒、部品の間は 3 秒で時間切れ。報告の送信は送信のキーで何度送っても 1 件なので画面はやり直してよい。それ以外の書き込みは自動でやり直さない [Q6]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
