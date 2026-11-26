# NFR Requirements — 質問（U3 `u3-review-list`: 確認の操作と一覧）

前提: `construction/u3-review-list/functional-design/`（functional-spec・rules・entities・frontend-components）、`inception/requirements-analysis/requirements.md`（NFR1〜NFR14）、`inception/contract-design/contract-summary.md`（C3・C4・C13・C14）、`construction/u1-skeleton/nfr-requirements/`（U1 で決めた NFR と技術の選択）、`construction/u2-report-duplicate/nfr-requirements/`（U2 で足した分）。

U3 は外部のサービスを使わず、新しい技術も増えません（U1 で決めた DynamoDB・Lambda・React のまま）。新しく出てくるのは、**一覧の絞り込みと数え上げ**、**10 秒の取り消し**、**同時の操作の捌き方**です。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 絞り込みを掛けた一覧の応答時間を、どこまで約束しますか？

U1 で「一覧は 95% のリクエストで 3 秒以内」（NFR2.1）と決めました。U3 では、絞り込みのときに**条件に合う行を最後まで数える**（機能設計の Q2）ため、読む量が増えます。上限は 2,000 件です。

A. **絞り込みがあってもなくても 3 秒以内を守る**（2,000 件を読んでも、DynamoDB の読み出しは 1 回あたり 100 件程度なので 20 回ほど。数百ミリ秒で終わる見込み）。守れないときは、読む上限を下げる
B. 絞り込みのときだけ 5 秒以内にゆるめる
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 「取り消す」の残り時間を、画面はどう数えますか？

確定から 10 秒だけ取り消せます（BR3.9）。サーバーが `undoUntil`（期限の時刻）を返し、画面はそれまでの残り時間を数えてボタンを消します。画面の時計とサーバーの時計がずれていると、残り時間の表示もずれます。

A. **サーバーが返した期限の時刻と、画面が受け取った時刻の差から残り時間を求める**（画面の時計の絶対値を使わない）。時計がずれていても残り時間は正しく、受け付けの判断はサーバーが行う（BR3.9）
B. サーバーが「あと何秒」という数字を返し、画面はそれを減らしていく（作りは単純だが、通信の遅れの分だけ長く見える）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] 同時の操作で弾かれたとき、画面はどうしますか？

2 人の依頼元が同時に操作すると、あとの人は「すでに確認済みです（承認、◯◯）」になります（AC4.6.1）。この画面をどう見せるかで、使い勝手が変わります。

A. **エラーとして赤く出さず、「すでに確認済みです（承認、◯◯）」と状態を出し直す**（押し間違いではなく、ほかの人が先に確認しただけなので）。ボタンは消す
B. エラーとして目立つ形で出す（見落とさないが、使う人を驚かせる）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] U3 で新しく見張るものを、増やしますか？

U1・U2 でアラームは 2 つのままにしました（無料枠は 10 個まで）。U3 では却下・取り消し・同時の操作が増えます。

A. **アラームは増やさず、ログに記録して必要なときに見る**（却下の件数、取り消しの件数、同時の操作で弾かれた回数、絞り込みで読む上限に当たった回数）。U1 の関数のエラーのアラームが重大な失敗は拾う
B. 同時の操作で弾かれた回数のアラームを 1 つ足す（3 つ目）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
