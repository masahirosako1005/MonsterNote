# Delivery Planning — 質問

前提: `inception/units-generation/`（Unit 4 個。U1 細い版、U2 報告と重複、U3 確認と一覧、U4 アカウントと管理。U2 と U3 は同時に作れる）、`inception/contract-design/contract-summary.md`（約束 17 個）、`inception/practices-discovery/team-practices.md`（最初に細い版を作る、TDD、AWS は dev の 1 つ、人の確認のあとデプロイ、PR と Squash and merge）、`ideation/approval-handoff/initiative-brief.md`（1 か月以内、費用は月 100 円以内）、`inception/requirements-analysis/requirements.md`。

このステージでは、作る順番と計画を決めます。作る単位は **Bolt**（ボルト: 1 つ以上の Unit をまとめて一通り作り、動くものができるところまで進める 1 回分の作業）と呼びます。

すでに決まっていること（聞き直しません）:
- 最初の Bolt は U1（最初の細い版。端から端まで一通り動く最小の版）。dev にデプロイして動くことを確かめ、人が承認してから次に進む（team-practices）
- U4 は U1〜U3 のあと（依存関係）
- 作るのは開発者 1 人＋AI（Team Formation はスキップ）

各質問の `[Answer]:` に記号を書いてください。

## Q1. [デリバリーリード] 細い版（U1）のあと、U2 と U3 はどちらを先に作りますか？

A. U2（報告と重複）を先に。報告の作成と重複の検出は一番の価値で、種類の判別の精度（実際の写真で試す）と重複の判定という一番大きなリスクも U2 にある。早く確かめるほど、1 か月の中で手を打てる
B. U3（確認と一覧）を先に。依頼元が使う画面を先に仕上げる
C. U2 と U3 を同時に進める
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q2. [デリバリーリード] 作る順番を、点数を付ける方法（WSJF: 価値・急ぎ・リスクの減り方を、大きさで割った点数の高い順）で決めますか？

A. 使わない。Bolt が 4〜5 個で依存もほぼ決まっているため、理由を文章で書けば十分
B. 使う。各 Bolt に点数を付けて並べる
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q3. [デリバリーリード] 1 つの Bolt の大きさは、どうしますか？

U2 は 15 ストーリーと一番大きく、Should（写真の重複・月の輪）の 2 ストーリーを含みます。

A. U2 だけ 2 つの Bolt に分ける（Must の部分と、Should の部分）。ほかは 1 Unit ＝ 1 Bolt。合計 5 Bolt。Should の Bolt は、時間が足りなければ次の版に回せる
B. すべて 1 Unit ＝ 1 Bolt（合計 4 Bolt）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [デリバリーリード] Bolt は同時に進めますか、1 つずつ進めますか？

A. 1 つずつ進める。開発者は 1 人で、U2 と U3 は全体で 1 つの AWS の構成（CDK）や API の定義を同時に触るため、取り込みのときに衝突しやすい
B. U2 と U3 を同時に進める（AI に別々の作業ブランチで作らせる）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q5. [デリバリーリード] 種類の判別の精度を確かめる試験用の写真（クマ・イノシシ・シカ、各 10 枚以上の捕獲後の写真。requirements FR3.5）は、どう集めますか？

A. 公開されている写真（利用条件を確かめたもの）で集め、試験運用の前にハンターから実際の写真をもらって確かめ直す
B. 最初からハンターに実際の写真を提供してもらう（届くまで、精度の確認は待つ）
C. 試験用の写真は集めず、試験運用で確かめる
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:C

## Q6. [デリバリーリード] この開発で一番心配なことは何ですか？（早めに確かめる順番に反映します）

A. 1 か月に間に合うか（U2 が大きい）
B. 種類の判別の精度（捕獲後の写真で正しく判別できるか）
C. AWS の費用が月 100 円に収まるか
D. 高齢のハンターが使いこなせるか
X. Other (please specify)

[Answer]:C

---

以下は、回答を読んで確認が必要になった点の追加質問です。

## Q7. [デリバリーリード] U2 と U3 の進め方（Q1 と Q4 の食い違い）

Q1 で「U2 を先に作る」（A）、Q4 で「U2 と U3 を同時に進める」（B）を選びました。どちらに合わせるかを選んでください。

同時に進める場合は、AI が U2 と U3 を別々の作業ブランチで作り、それぞれ PR で取り込みます。全体で 1 つの AWS の構成（CDK）や API の定義を両方が触るため、取り込みのときに衝突を直す手間が出ることがあります。また、Construction の進め方を「ステージごとにまとめて進める」（設計の各ステージを Unit ごとではなく全 Unit まとめて進める）形に変える必要があります。

A. 同時に進める（Q4 の B）。U1 のあと、U2 と U3 を同時に作る。U2 の中で、種類の判別と重複の判定を先に作る（Q1 の意図をこう生かす）
B. 1 つずつ進める（Q4 を A に変える）。U1 → U2 → U3 → U4 の順
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q8. [デリバリーリード] 種類の判別の精度の確かめ方（Q5 と承認済みの要件の食い違い）

Q5 で「試験用の写真は集めず、試験運用で確かめる」（C）を選びました。一方、承認済みの要件 FR3.5 は「3 種類それぞれ 10 枚以上の捕獲後の写真（合計 30 枚以上）で確かめ、70% 以上を目標とし、結果は Build and Test で記録する」と決めています。

A. 要件に合わせ、Q5 を変える。公開されている写真（利用条件を確かめたもの）で 30 枚以上を集め、Build and Test で確かめる（Q5 の A）
B. Q5 のとおり試験運用で確かめる。FR3.5 の確かめる時期を「Build and Test」から「試験運用」に変える（要件の変更として記録し、Build and Test では判別の仕組みが動くことだけを確かめる）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Consolidated Summary Confirmation

- 作る順: 最初は U1（細い版）。U1 が dev で動き、人が承認したあと、U2 と U3 を同時に進める。U2 の中では種類の判別と重複の判定を先に作る。最後に U4 [Q1][Q7]
- 決め方: 点数（WSJF）は使わず、順番の理由を文章で書く [Q2]
- Bolt の大きさ: U2 だけ Must の部分（U2a）と Should の部分（U2b: 写真の重複・月の輪）の 2 Bolt に分け、合計 5 Bolt。U2b は時間が足りなければ次の版に回す [Q3]
- 同時に進めること: U2（Must）と U3 を同時に進める。そのため Construction の進め方を「ステージごとにまとめて進める」（stage-major）に変え、コードの生成を同時に動かす設定（swarm）にする [Q4][Q7]
- 種類の判別の精度: 試験用の写真は集めず、試験運用で確かめる。要件 FR3.5 の確かめる時期を「Build and Test」から「試験運用」に変える（要件の変更としてこのステージに記録する）。Build and Test では、判別の仕組みが動くこと（判別できた・できなかったの両方の流れ）だけを確かめる [Q5][Q8]
- 一番の心配: AWS の費用が月 100 円に収まるか。各 Bolt の完了条件に「タグ別の費用の確認」を入れ、早めに確かめる [Q6]
- 作る人: すべての Bolt を AI（開発者のエージェント）が作り、開発者本人が確認する（Team Formation はスキップ）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
