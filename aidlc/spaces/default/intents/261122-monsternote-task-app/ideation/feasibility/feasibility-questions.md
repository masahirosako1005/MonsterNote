# Feasibility & Constraints — 質問

前提: `ideation/intent-capture/intent-statement.md`、`ideation/market-research/`（competitive-analysis.md・market-trends.md・build-vs-buy.md）、プロジェクトのルール（`aidlc/spaces/default/memory/project.md`）、技術環境（`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`）。

技術環境とルールで決まっていること（AWS 東京リージョン、フルサーバレス、TypeScript、無料枠中心、常時課金のリソースは使わない など）は質問していません。調べて分かったことは各質問に出典付きで書きました。各質問の `[Answer]:` に記号を書いてください。

## Q1. [AWS 担当] 使う AWS アカウントの「無料枠」は、いまどの状態ですか？

無料枠の条件はアカウントの作成時期で変わります。2025 年 7 月 15 日より前に作ったアカウントは従来の無料枠（作成から 12 か月の無料枠＋ずっと無料の枠）、それ以降に作ったアカウントはクレジット型（最大 200 ドル、最長 6 か月）です。写真の種類判別（Amazon Rekognition の DetectLabels）は、従来の無料枠なら作成から 12 か月は月 1,000 枚まで無料、それを過ぎると 1 枚あたり約 0.001 ドル（米国東部の価格。東京の価格は要確認）です。API の窓口やファイル置き場など、ほかにも 12 か月だけ無料のサービスがあります。
出典: https://aws.amazon.com/rekognition/pricing/ 、https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan 、https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html

A. 作成から 12 か月以内（従来の無料枠がまだ使える）
B. 作成から 12 か月を過ぎている（ずっと無料の枠だけが使える）
C. 2025 年 7 月 15 日以降に作った（クレジット型の無料枠）
D. 分からない（AWS の請求コンソールの「無料利用枠」で確認してから書く）
X. Other (please specify)

[Answer]:A

## Q2. [プロダクトオーナー] 試験運用で、1 か月に届く報告はおよそ何件ですか？

費用の見積もりに使います。1 件の報告に写真を 2〜3 枚（全身・顔など）付ける前提です（Intent Capture の Q21）。例: 月 200 件 × 3 枚 = 600 枚 → 種類判別の費用は約 0.6 ドル（約 90 円）。

A. 月 50 件未満
B. 月 50〜200 件
C. 月 200 件を超える
D. まだ分からない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q3. [プロダクトオーナー] 費用（月 100 円以内）は、どう測りますか？

この AWS アカウントは別プロジェクト（mononoke）と共用なので、アカウント全体の請求額では MonsterNote の分が分かりません（Intent Capture のレビュー指摘 R-01）。

A. MonsterNote のリソースに付けるタグ（`Name=masahiro-<サービス名>-monsternote`）で費用を分け、請求コンソールのタグ別の表示で確認する
B. アカウント全体の請求額が、MonsterNote を始める前より増えた分で見る
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [プロダクトオーナー] 報告履歴を見る「お客様」（導入を検討する自治体）に、どこまで見せますか？

報告には、ハンターの氏名や捕獲した場所など、個人に結びつく情報が含まれます（Intent Capture のレビュー指摘 R-05）。

A. すべて見せる（氏名・正確な位置・写真）
B. 氏名は伏せ、位置は市町村や地区の単位までにする
C. お客様には件数などの集計だけを見せ、1 件ずつの報告は見せない
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q5. [プロダクトオーナー] ハンターの「捕獲従事者」の番号など、許可に関する情報を報告に含めますか？

国の捕獲確認マニュアルでは、個体に従事者番号を書いて撮る、従事者証明書を一緒に写すといった確認方法が示されています（Market Research の market-trends.md）。国の交付金の実績報告にも使える形で記録すると決めています（Market Research の Q8）。

A. 含める（ハンターごとに従事者番号を登録し、報告に自動で付ける）
B. 含めない（写真に写すだけで、アプリでは記録しない）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q6. [プロダクトオーナー] 山の中など電波が届かない場所でも、報告を作れる必要がありますか？

既存の捕獲報告アプリの多くは圏外でも使えます（Market Research の competitive-analysis.md）。圏外対応は作る難しさが大きく上がります。

A. 必要。圏外で報告を作っておき、電波が届いたら自動で送る
B. 不要。写真だけスマホのカメラで撮っておき、電波のある場所で報告する
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q7. [プロダクトオーナー] 最初の版（試験運用）は、いつまでに使える状態にしたいですか？

A. 1 か月以内
B. 3 か月以内
C. 期限は特にない（教材づくりのペースに合わせる）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

---

以下は、回答を読んで確認が必要になった点の追加質問です。

## Q8. [プロダクトオーナー] 「1 か月以内」と「最初の版から除外するものはなし」をどう両立しますか？

2 つの回答が食い違う可能性があります。
- Q7: 最初の版は 1 か月以内に使える状態にしたい
- Intent Capture の Q8・Q17: 最初の版から除外する機能はない（写真からの種類・雌雄の判別、重複の検出、外部の参照、レポート出力、交付金の実績報告に使える記録、クマ・イノシシ・シカの 3 種類）

開発者 1 人＋AI で、これらをすべて 1 か月で作るのは難しいと考えられます（仮定）。

A. 期限を延ばす（3 か月以内など）。範囲はそのまま
B. 1 か月を守る。次の Scope Definition ステージで優先度を付け、最初の版に入れる機能を絞る
C. 1 か月で全部に挑戦し、間に合わなかった機能は次の版に回す
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Q9. [プロダクトオーナー] お客様に氏名や正確な位置を見せることについて、ハンターの同意をどう扱いますか？

Q4 で「お客様にすべて見せる（氏名・正確な位置・写真）」と回答がありました。ハンターの氏名などは個人情報で、本人以外の組織（勤務先のお客様）に見せるには、本人の同意を得ておくのが一般的です（仮定。法的な扱いの詳細は Compliance の観点で後のステージで確認）。

A. 利用を始めるときに、ハンターから同意を得る（同意の画面を用意する）
B. お客様には、実際の報告ではなくデモ用の架空のデータだけを見せる
C. Q4 を見直し、氏名は伏せ、位置は市町村や地区の単位までにする
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- AWS アカウント: 作成から 12 か月以内で、従来の無料枠が使える。写真の種類判別は月 1,000 枚まで無料 [Q1]
- 報告件数: 試験運用で月 50 件未満（写真は月 150 枚程度まで）。種類判別は無料枠内に収まる見込み [Q2]
- 費用の測り方: MonsterNote のリソースに付けるタグで費用を分け、請求コンソールのタグ別表示で月 100 円以内かを確認する [Q3]
- お客様への公開: 氏名・正確な位置・写真をすべて見せる。ハンターからは利用開始時に同意を得る（同意の画面を用意する） [Q4][Q9]
- 捕獲従事者の番号: ハンターごとに登録し、報告に自動で付ける [Q5]
- 圏外対応: 不要。写真はスマホのカメラで撮っておき、電波のある場所で報告する [Q6]
- 期限: 最初の版は 1 か月以内に使える状態にする。そのため次の Scope Definition で優先度を付け、最初の版に入れる機能を絞る [Q7][Q8]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
