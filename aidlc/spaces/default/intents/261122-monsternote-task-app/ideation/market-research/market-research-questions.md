# Market Research & Competitive Analysis — 質問

前提: intent-statement.md（害獣ハンターの報告アプリ MonsterNote、試験運用は市町村の担当課と猟友会）。

質問を作る前に、公開情報を調べました（2026-11-23 時点、出典は各質問に記載）。各質問の `[Answer]:` に記号を書いてください。複数選べる質問は `A, C` のように書けます。

## Q1. [プロダクトオーナー] すでにある「捕獲報告アプリ」と MonsterNote の関係をどうしますか？

農林水産省の「鳥獣被害対策に活用出来る機器情報」には、スマホで捕獲個体を登録・報告できる製品が載っています。例: スマートHOKAKU（撮影時に体長・体重を自動推計、捕獲情報の自動記録）、ラクログ（帳票作成・捕獲データの一元管理、捕獲従事者用アプリは無料）、ディアナ（捕獲個体記録・わな管理）。
出典: https://www.maff.go.jp/j/seisan/tyozyu/higai/kikijouhou/kikijouhou.html

A. 既存製品は参考にとどめ、MonsterNote は自分で作る（AI-DLC の学習と教材化が目的のため）
B. 既存製品で足りるなら、作らずに既存製品を使う
C. 自分で作るが、将来は既存製品とデータをやり取りできるようにする
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q2. [プロダクトオーナー] 既存製品と比べて、MonsterNote の強み（差別化）はどれにしますか？（当てはまるものをすべて選んでください）

A. 同じ個体の重複登録を自動で見つけ、依頼元に知らせる
B. 高齢のハンターでも迷わない、大きなボタン・選択式の簡単な操作
C. 運用費がほぼかからず、小さな市町村や猟友会でも使える
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A,B,C

## Q3. [プロダクトオーナー] 国の「捕獲確認マニュアル」の確認方法に合わせますか？

国の交付金では、証拠写真を偽装して不正に受給する事案があり、2025 年 4 月に捕獲確認マニュアルが改訂されました。確認の方法として、GPS 機能付きカメラ（スマホを含む）での撮影、個体へのマーキング（従事者番号や捕獲月日の記入）、尻尾の切断前・切断後の写真と尻尾の提出などが示されています。
出典: https://www.maff.go.jp/j/seisan/tyozyu/higai/yosan/attach/pdf/yosan-180.pdf 、https://www.city.kimitsu.lg.jp/uploaded/attachment/55711.pdf 、https://www.pref.ibaraki.jp/seikatsukankyo/shizen/shizen/chouju/shikahokaku.html

A. 合わせる。マニュアルの確認方法（位置付きの写真、マーキング、尻尾の写真）をアプリの報告手順に組み込む
B. 参考にする程度。MonsterNote 独自の報告手順にする
C. 合わせない
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q4. [プロダクトオーナー] 最初の版で対象にする害獣の種類はどれですか？（当てはまるものをすべて選んでください）

種類ごとに証拠の取り方や、個体を見分ける手がかりが違います（例: 鳥類は両脚、獣類は尻尾が証拠物とされる運用がある）。
出典: https://www.city.okayama.jp/jigyosha/cmsfiles/contents/0000016/16858/hokaku.pdf

A. クマ（ツキノワグマ・ヒグマ）
B. イノシシ
C. シカ
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A.B.C

## Q5. [プロダクトオーナー] クマの「胸の月の輪」による個体の見分けを、重複の判定に使いますか？

ツキノワグマは、胸の月の輪の形や大きさで個体を見分ける調査が行われています。ただし、月の輪の全体がきれいに写った写真でないと使えず、栃木県の調査では見分けられた写真の割合は平均 48.6% でした。
出典: https://www.pref.tochigi.lg.jp/d57/documents/4_1.pdf 、https://www.pref.nara.jp/secure/248673/r2shinrinshigen6.pdf 、https://www.pref.fukui.lg.jp/doc/shizen/tixyouzixyuu/tukinowaguma2_d/fil/015.pdf

A. 使う。ただし補助的な手がかりとし、場所・日時・写真の類似と組み合わせる
B. 使わない。場所・日時・写真の類似だけで判定する
C. 使えるかどうかは Feasibility ステージで判断する
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q6. [プロダクトオーナー] 重複などの疑いが見つかったとき、ハンター本人にも知らせますか？

既存製品の中には、写真の位置情報などに不整合があった場合、捕獲者には通知せず管理者だけが確認できるようにしているものがあります（製品提供元の説明による）。
出典: https://www.maff.go.jp/j/seisan/tyozyu/higai/kikijouhou/attach/pdf/kikijouhou-147.pdf

A. 依頼元にだけ知らせ、ハンターには知らせない
B. ハンターにも知らせる（登録前に「同じ個体ではありませんか」と確認する）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q7. [プロダクトオーナー] 将来、どこまで広げることを想定しますか？（市場の大きさの目安）

市場の大きさをどう見積もるかを決めるための質問です。

A. 試験運用の市町村・猟友会だけ（広げる予定はない）
B. 勤務先のお客様（導入を検討する自治体）へ広げる
C. 全国の市町村・猟友会へ広げる
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Q8. [プロダクトオーナー] 報告の記録を、国の交付金の実績報告にも使える形にしますか？

依頼元が賞金（報奨金）を払う仕組みとは別に、国の交付金にも捕獲の実績報告が必要です。

A. 依頼元の賞金の確認だけに使う
B. 国の交付金の実績報告にも使える形（必要な項目と写真）で記録する
C. 最初の版は A、次の版で B を検討する
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Consolidated Summary Confirmation

- 既存製品との関係: 既存の捕獲報告アプリ（スマートHOKAKU、ラクログ、ディアナなど）は参考にとどめ、MonsterNote は自分で作る（AI-DLC の学習と教材化が目的） [Q1]
- 強み: 重複登録の自動検出、高齢ハンター向けの大きなボタン・選択式の簡単な操作、運用費がほぼかからず小さな市町村・猟友会でも使える [Q2]
- 国の捕獲確認マニュアルに合わせる: 位置付きの写真、個体へのマーキング、尻尾の写真を報告手順に組み込む [Q3]
- 対象の害獣: クマ、イノシシ、シカ [Q4]
- クマの月の輪: 重複判定の補助的な手がかりとして使い、場所・日時・写真の類似と組み合わせる [Q5]
- 重複の疑いの通知: ハンターにも知らせる（登録前に「同じ個体ではありませんか」と確認する） [Q6]
- 広げる範囲: 勤務先のお客様（導入を検討する自治体）へ広げることを想定する [Q7]
- 交付金: 国の交付金の実績報告にも使える形（必要な項目と写真）で記録する [Q8]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
