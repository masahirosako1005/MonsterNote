# NFR Design — 質問（U2 `u2-report-duplicate`: 報告の作成と重複の疑い）

前提: `construction/u2-report-duplicate/nfr-requirements/`（performance・security・scalability・reliability・observability の要件、tech-stack-decisions）、`construction/u2-report-duplicate/functional-design/`（functional-spec・rules・entities）、`construction/u1-skeleton/nfr-design/`（U1 の設計。知らせの届け方・送信のキーの状態・CSP などをここで引き継ぐ）、`inception/contract-design/contract-summary.md`。

U2 は、U1 で決めた「知らせの届け方」（eventSent の印、最大 3 回のやり直し）と「送信のキーの状態」の仕組みを、報告の送信全体（重複の判定を含む）に広げます。新しく出てくるのは、**外部のサービス（画像認識）の呼び出し方**、**判別の回数の上限の数え方**、**24 時間の自動削除の具体**です。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 判別のサービスの呼び出しに、サーキットブレーカーを入れますか？

判別のサービス（Rekognition）が一時的に調子を崩したとき、毎回 3 秒待ってから失敗を返すと、同時に送られた複数の報告がすべて待たされます。

A. **入れない**。判別は 3 秒で区切って「判別できなかった」とする決まり（NFR2.8）がすでにあり、報告の作成は止まらない。試験運用の規模（同時 10 人以下）では、サーキットブレーカーの効果より実装の複雑さが勝る
B. 入れる（直近の失敗の割合を見て、一定期間は呼ばずに「判別できなかった」を返す）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 判別の呼び出し回数の上限（1 人 1 日 30 回）は、どこに数えを持ちますか？

NFR12.5 で「1 人のハンターにつき 1 日 30 回まで」と決めました。数える記録の持ち方を決めます。

A. **DynamoDB に 1 行（accountId＋日付をキー）を持ち、「30 未満」を条件に 1 増やす書き込みで数える。行には TTL（2 日）を付けて自動的に消す**。U3・U4 で確立した「条件にした 1 回の書き換え」と同じ考え方
B. 判別を呼ぶ前に、その日の判別の記録（DetectionResult）を検索して数える（行を新しく持たない）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] 重複の判定で読む 500 件の上限は、どう打ち切りますか？

NFR12.6 で「1 回の判定で読むのは 500 件まで」と決めました。DynamoDB のクエリは 1 回で 100 件程度しか返さないため、複数回のページ読みになります。

A. **ページを読み進めながら件数を数え、500 件に達したら、そのページの読み込みを最後まで終えてから打ち切る**（まだ読んでいない日や索引を残さない。1 日分の索引は最後まで読み切ることで、同じ日の中で判定が偏らないようにする）
B. 500 件目のちょうどで打ち切る（ページの途中でも止める）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] 24 時間の自動削除（TTL とライフサイクル）の具体の値を、どう決めますか？

U2 の機能設計で「AWS の自動削除に任せる」と決め、NFR12.7 で「最大 1〜2 日ほど遅れる」としました。具体の時間を決めます。

A. **DynamoDB の TTL は `uploadedAt + 24 時間`（Unix 時間）を設定し、AWS の削除（最大 48 時間以内）に任せる。S3 のライフサイクルは「1 日経過で削除」にする（S3 のライフサイクルは日単位でしか指定できないため、最短の 1 日にする）**
B. S3 のライフサイクルを 2 日にする（確実に DynamoDB の削除より後になるようにする）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] 判別と重複の判定の関数のメモリは、U1 の決まり（128〜256 MB）のどちらにしますか？

NFR12.8 で「判別を呼ぶ関数と重複の判定の関数は 256 MB」と決めています。

A. **両方とも 256 MB で確定する**（外部のサービスの呼び出しと、ハバーサインの計算があるため。NFR12.8 のとおり）
B. 判別を呼ぶ関数だけ 256 MB、重複の判定は計算だけなので 128 MB にする
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
