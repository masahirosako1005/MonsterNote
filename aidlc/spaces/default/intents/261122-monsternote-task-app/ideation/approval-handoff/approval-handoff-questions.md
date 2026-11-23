# Initiative Approval & Handoff — 質問

前提: Ideation のすべての成果物（`ideation/intent-capture/`、`ideation/market-research/`、`ideation/feasibility/`、`ideation/scope-definition/`、`ideation/rough-mockups/`）。Team Formation は開発者 1 人＋AI のためスキップした。

このステージでは、Ideation の内容をまとめた「企画書」（initiative-brief.md）を作り、次の Inception（要件・設計）に進んでよいかを決めます。各質問の `[Answer]:` に記号を書いてください。

## Q1. [プロダクトオーナー] 関係者の合意はどう扱いますか？

決める人はあなたで、ハンター・依頼元の意見は試験運用のあとに直接聞く、と決めています（Intent Capture の Q16・Q24）。

A. 決める人（自分）として、ここまでの意図と範囲に同意する。ハンター・依頼元には試験運用の前に説明する
B. 先に依頼元（市町村の担当課・猟友会）にも企画書を見せて合意を取ってから Inception に進む
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q2. [プロダクトオーナー] 主なリスクと対策を、このまま受け入れますか？

Feasibility の raid-log.md の主なリスク:
- 1 か月に間に合わない → Scope Definition で機能を絞った（Must 8・Should 2）
- 写真から雌雄を自動判別できない → 最初の版はハンターが選ぶ
- 捕獲後の写真で種類が正しく判別されない → 早い段階で実際の写真で試し、ハンターが直せるようにする
- 別の角度の同じ個体を見逃す → 場所・日時の近さ、マーキング・尻尾と組み合わせ、最終判断は依頼元
- ハンターの個人情報・位置情報の扱い → 利用開始時の同意、見せる相手を限る

A. このまま受け入れる
B. 一部を見直したい（どのリスクか、どうしたいかを書いてください）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q3. [プロダクトオーナー] 時間と費用の約束はこれでよいですか？

A. 開発は自分（＋AI）で 1 か月以内、AWS の費用は MonsterNote の分で月 100 円以内。これで進める
B. 時間か費用の条件を変えたい（内容を書いてください）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [プロダクトオーナー] 画面案（rough-mockups）は、目指す姿と合っていますか？

レビューで残った小さな指摘（却下理由「その他」の自由記入、下書きがスマホの中だけにあること）は、要件の段階で扱うと決めています。

A. 合っている（残りの指摘は要件の段階で扱う）
B. 合っていない点がある（内容を書いてください）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [プロダクトオーナー] 次の Inception（要件・設計）に進みますか？（Go / No-Go）

市場調査では、業務で使うだけなら既存製品を買う方がやや有利ですが、学習と教材化が目的のため自分で作ると決めています（build-vs-buy.md）。

A. Go: Inception に進む
B. 条件付きで Go（条件を書いてください）
C. No-Go: ここで止める
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 関係者の合意: 決める人（自分）として、ここまでの意図と範囲に同意する。ハンター・依頼元には試験運用の前に説明する [Q1]
- リスクと対策: raid-log.md の主なリスク（期限、雌雄の自動判別、捕獲後の写真での種類判別、別角度の同じ個体、個人情報・位置情報）と対策を、このまま受け入れる [Q2]
- 時間と費用: 開発は自分（＋AI）で 1 か月以内、AWS の費用は MonsterNote の分で月 100 円以内 [Q3]
- 画面案: rough-mockups は目指す姿と合っている。残りの小さな指摘（却下理由「その他」の自由記入、下書きがスマホの中だけにあること）は要件の段階で扱う [Q4]
- Go / No-Go: Go。Inception（要件・設計）に進む [Q5]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
