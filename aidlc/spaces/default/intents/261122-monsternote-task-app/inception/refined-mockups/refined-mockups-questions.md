# Refined Mockups — 質問

前提: `ideation/rough-mockups/wireframes.md`・`user-flow.md`（ラフな画面案。H1〜H9、R1〜R3）、`inception/user-stories/stories.md`（US1.1〜US7.2）、`inception/requirements-analysis/requirements.md`（NFR7 アクセシビリティ、NFR8 マテリアルデザイン、NFR9 対応する機器）、`inception/practices-discovery/team-practices.md`（TypeScript、frontend / backend / infra）。

すでに決まっていること（聞き直しません）:
- ハンター側: 文字 20px 以上、ボタン高さ 64px 以上・画面幅いっぱい、色だけに頼らない、WCAG 2.1 AA、1 画面に 1 項目（RM Q5・Q2）
- Google のマテリアルデザインに沿う（RM Q6）
- 報告の作成は通常 7 ステップ、クマは 8 ステップ。下書きは残さない（requirements FR2.1・FR2.9）
- 管理者用の画面を作る（US Q4）

このステージでは、ラフな画面案を「作る人が迷わない」細かさの画面案に仕上げます。各質問の `[Answer]:` に記号を書いてください。

## Q1. [デザイナー] 画面を作る部品集（コンポーネントライブラリ）は、どれを使いますか？

マテリアルデザインに沿った、ボタンや入力欄などの部品の集まりです。画面の作り方（フレームワーク）もこれで決まります。

A. React ＋ MUI（Material UI）。利用者が最も多く、情報が見つけやすい
B. Vue ＋ Vuetify
C. Angular ＋ Angular Material
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q2. [デザイナー] 画面の基本の色（テーマカラー）は、どうしますか？

A. 森の緑（濃い緑を主な色に、注意は橙、危険は赤）。屋外でも見やすいよう、コントラストを高めにする
B. 茶色系（大地の色）
C. マテリアルデザインの初期の色（青）のまま
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q3. [デザイナー] 暗い画面（ダークモード）に対応しますか？

A. 対応しない（明るい画面だけ）。屋外の日差しの下で見やすいことを優先する
B. スマホの設定に合わせて切り替える
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q4. [デザイナー] 画面の幅に応じた切り替え（ブレークポイント）は、どうしますか？

A. 3 段階: スマホ（〜599px）・タブレット（600〜1023px）・パソコン（1024px〜）。ハンター側はスマホの縦向きを基準に、タブレットでも同じ 1 列の表示。依頼元・管理者側は、パソコンでは一覧と詳細を左右に並べ、スマホでは画面を切り替える
B. 2 段階: スマホ（〜1023px）とパソコン（1024px〜）だけ
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [デザイナー] 依頼元・管理者側の文字とボタンの大きさは、どうしますか？

ハンター側は「文字 20px 以上・ボタン高さ 64px 以上」と決まっています。

A. 標準の大きさ（文字 16px、ボタン高さ 40〜48px）。パソコンで一覧を多く見られるようにする。WCAG 2.1 AA は守る
B. ハンター側と同じ大きさ
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q6. [デザイナー] 日時・場所を手で入れる画面（写真に情報がないとき）は、どんな操作にしますか？

A. 日時は「今日」「昨日」などの大きなボタンと時刻の選択。場所は地図を表示し、「今いる場所」ボタンで現在地に移動してから、地図をタップして印を置く
B. 日時はカレンダーと時刻の入力。場所は住所を文字で入れて地図に表示する
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 部品集とフレームワーク: React ＋ MUI（Material UI） [Q1]
- 基本の色: 森の緑（濃い緑が主な色、注意は橙、危険は赤）。屋外でも見やすいようコントラストを高めにする [Q2]
- ダークモード: 対応しない（明るい画面だけ） [Q3]
- ブレークポイント: スマホ（〜599px）・タブレット（600〜1023px）・パソコン（1024px〜）。ハンター側は 1 列の表示。依頼元・管理者側は、パソコンで一覧と詳細を左右に並べ、スマホでは画面を切り替える [Q4]
- 依頼元・管理者側の大きさ: 文字 16px、ボタン高さ 40〜48px。WCAG 2.1 AA は守る [Q5]
- 日時・場所の手入力: 日時は「今日」「昨日」などの大きなボタンと時刻の選択。場所は地図に「今いる場所」ボタンで移動し、タップして印を置く。地図のサービスは Infrastructure Design で決める（requirements の OQ-3） [Q6]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
