# Units Generation — 質問

前提: `inception/domain-design/components.md`（部品 12 個）・`decisions.md`（ADR-001〜ADR-012）、`inception/requirements-analysis/requirements.md`、`inception/user-stories/stories.md`（US1.1〜US7.2。🦴 が最初の細い版）、`inception/practices-discovery/team-practices.md`（最初に細い版を作る、TDD、AWS の環境は dev の 1 つ、PR と Squash and merge）。

このステージでは、12 個の部品を「作る単位」（Unit）にまとめ、Unit どうしの依存関係（どれがどれを前提にするか）を決めます。どの順番で作るか（作る順の優先度）は、次の次の Delivery Planning で決めます。

team-practices で「最初に、端から端まで一通り動く細い版を作る」と決めているため、1 つ目の Unit は細い版（ログイン → 写真 1 枚の報告 → 依頼元が承認）になります。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] Unit の切り方は、どれにしますか？

A. 機能ごとの縦切り。1 つの Unit に、その機能の API（裏側）と画面をまとめる（例: 「報告の作成」の Unit に Reporting・SpeciesDetection と HunterApp の報告の画面を入れる）。1 つの Unit が終わると、利用者が使える機能が 1 つ増える
B. 部品ごとの横切り。裏側の部品の Unit と、画面の Unit（ハンター・依頼元・管理者）を分ける
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] Unit の数（大きさ）は、どのくらいにしますか？

A. 7 個前後（細い版 1、アカウント 1、報告の作成 1、重複 1、確認 1、管理 1、Should 1）。1 つの Unit は 2〜5 日の作業
B. 4 個前後の大きめの Unit（細い版、報告と重複、確認と一覧、管理）
C. 12 個前後の細かい Unit（ほぼ部品ごと）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Q3. [アーキテクト] AWS への配置（デプロイ）の形は、どうしますか？

A. 全体を 1 つの AWS の構成（1 つの CDK アプリ）として配置する。裏側は機能ごとの小さな関数（Lambda）に分け、1 つの API の入口にまとめる。画面の 3 つのアプリも同じ構成で配置する。1 人で 1 つの dev 環境を管理するため、まとめて配置・戻せる形にする
B. Unit ごとに別々の AWS の構成（スタック）にし、Unit ごとに配置する
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] 1 つ目の Unit（最初の細い版）に入れる範囲は、これでよいですか？

案: ログイン（管理者が手順書で作ったアカウント）→ ハンターが全身の写真 1 枚と、手で選んだ種類・雌雄を送る → 依頼元が一覧で見て承認する → ハンターの一覧に「承認」と出る。そのために必要な最小の部品（Accounts・Reporting・Review・ReportCatalog・UiKit の一部、HunterApp・RequesterApp の最小の画面）と、AWS の土台（認証、写真の保存場所、データベース、API の入口、2 つの画面の公開）を作り、dev にデプロイして確かめる（stories の 🦴 6 個）。

A. この範囲でよい
B. 範囲を変えたい（内容を書いてください）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] 依存関係のない Unit どうしを、同時に進めてよいことにしますか？

AI-DLC の Construction では、依存のない Unit を別々の作業ブランチで同時に作ることができます（作る順と、実際に同時に進めるかは後で決めます）。

A. 依存関係の上では同時に進めてよいことにする（実際に同時に進めるかは Delivery Planning と Construction で決める）
B. すべての Unit を 1 列の依存（前の Unit が終わらないと次に進めない）にする
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 切り方: 機能ごとの縦切り。1 つの Unit に、その機能の API（裏側）と画面をまとめる [Q1]
- 数: 大きめの 4 個 [Q2]。Q2 の B に名前のなかったストーリーは、近い Unit に入れる（アカウントの初回の手続きは管理の Unit、Should は報告と重複の Unit、設定の部品の裏側は報告と重複の Unit・設定の画面は管理の Unit）
  - U1 `u1-skeleton`（service）: 最初の細い版。ログイン → 写真 1 枚の報告 → 依頼元が承認 → ハンターの一覧（🦴 の US1.1・US2.1・US4.1・US4.2・US4.3・US5.1）と、AWS の土台
  - U2 `u2-report-duplicate`（service）: 完全な報告の作成（7・8 ステップ、写真、種類の判別、日時・場所の確認と手入力、交付金の項目）と重複の疑い、Should（写真・月の輪）（US2.2〜US2.11、US3.1〜US3.3、US7.1・US7.2）
  - U3 `u3-review-list`（service）: 却下・取り消し・同時の操作、一覧の絞り込みとページ分け、7 日以上の印、ハンターの詳細と却下の理由（US4.4〜US4.7、US5.2・US5.3）
  - U4 `u4-accounts-admin`（service）: 初回のパスワード変更・同意・従事者番号・ログインの保持と、管理者の画面（アカウント、設定、操作の記録、データの削除）（US1.2〜US1.5、US6.1〜US6.6）
- 依存: U2 と U3 は U1 だけを前提にする（部品の間の知らせの形は次の Contract Design で決め、それに合わせて作る）。U4 は、データの削除で全部品を呼ぶため U1・U2・U3 を前提にする [Q5]
- 配置: 全体を 1 つの AWS の構成（1 つの CDK アプリ）として dev に配置する。裏側は機能ごとの小さな関数（Lambda）、1 つの API の入口。3 つの画面も同じ構成で配置する [Q3]
- 1 つ目の Unit: 案のとおり（細い版の 6 ストーリーと AWS の土台を作り、dev にデプロイして確かめる） [Q4]
- 同時に進めること: 依存の上では U2 と U3 は同時に進めてよい（実際にどうするかは Delivery Planning・Construction で決める） [Q5]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
