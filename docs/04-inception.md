# 04. Inception（要件と設計）

## ゴール

Ideation で決めた「何を・なぜ作るか」をもとに、Inception では「どう作るか」を決める。具体的には、開発の進め方、要件、ユーザーストーリー、設計、作業の分け方を決める。この章でも、各ステージの質問・回答・承認の判断を記録する。

## 記録の読み方

- **AI の質問** … AI-DLC が作った質問ファイルや、チャットで出した選択肢
- **回答** … 自分が選んだ答え（質問ファイルを直接編集）
- **承認ゲート** … ステージが終わったときの判断（Approve / Request Changes など）と、その理由

## 1. Practices Discovery（開発の進め方の確認）

担当エージェント: Pipeline Deploy Agent（リリースエンジニア役）／ レビュー役: なし
実行方式: subagent（担当エージェントを別に起動して下書きを作らせる）

チームの開発の進め方を 5 つの観点で確認し、承認されたら `aidlc/spaces/default/memory/team.md`（チームのルール）に書き込む。

- ブランチとマージ（Way of Working）
- 最初に通しで動く最小版を作るか（Walking Skeleton）
- テストの進め方（Testing Posture）
- デプロイ（Deployment）
- コードの書き方（Code Style）

新規開発（Greenfield）なので、既存のコードからは読み取れない。そのため、フレームワークの既定値（org.md）を「提案」として示し、人が選ぶ。

> 💡 教材ポイント: 本来は担当エージェントの下書きを、品質・開発・セキュリティの 3 エージェントがそれぞれ独立に確認する（hub-and-spoke）。今回の `feature` スコープでは協力者（collaborators）の設定が off のため、担当エージェントが 1 人で進める。

### 担当エージェントの下書き（提案）
担当エージェントが、フレームワークの既定値を出発点にして下書きを作った。1 人で開発すること、サーバレス、無料枠内という条件に合わせて調整している。

- 進め方: main に直接取り込む開発（トランクベース）。作業ブランチは Bolt ごとに 1 コミットにまとめて取り込む。PR は必須にしない
- 最初の細い版: 作る（「ログイン → 写真 1 枚の報告 → 依頼元が承認」）
- テスト: 実装のあとにテストを書く（test-after）。行カバレッジは 80% 以上（`feature` の下限）
- デプロイ: AWS の環境は 1 つ（dev）。人が確認してから手元でデプロイ
- コード: TypeScript（strict）＋ ESLint・Prettier

> 💡 教材ポイント: フレームワークの既定値は「マージしたら staging に自動デプロイ」。しかし project.md の「デプロイ前に必ず人に確認する」と合わないため、担当エージェントは理由を付けて既定値から外した。上位の既定値（org.md）より、このプロジェクトのルールが優先される。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/practices-discovery/practices-discovery-questions.md`

| # | 観点 | 質問 |
|---|---|---|
| Q1 | 進め方 | main への取り込み方（PR を作るか） |
| Q2 | 進め方 | コミットをまとめるか（squash） |
| Q3 | 最初の細い版 | 端から端まで動く細い版を最初に作るか、その範囲 |
| Q4 | 最初の細い版 | 「動いた」ことを何で確かめるか |
| Q5 | テスト | テストを実装の前に書くか後に書くか |
| Q6 | テスト | 行カバレッジ 80% を求める範囲 |
| Q7 | テスト | E2E テストをいつ動かすか |
| Q8 | デプロイ | AWS の環境の数 |
| Q9 | デプロイ | デプロイの方法 |
| Q10 | デプロイ | タグを付けて戻せるようにするか |
| Q11 | コード | リポジトリの分け方 |
| Q12 | コード | コメント・名前の言語 |
| Q13 | 決まり | 新しく「必ず守る／絶対にしない」と決めたいこと |

> 💡 教材ポイント: ステージの説明では「Walking Skeleton」などの手順の言葉をそのまま使わず、意味を添えて聞くよう決められている（例: 「最初に、端から端まで一通り動く細い版を作りますか？」）。

### 回答（1 回目）
| # | 回答 |
|---|---|
| Q1 | B（毎回 PR を作り、GitHub の画面で確認してから取り込む） |
| Q2 | 「1」（どの選択肢か判別できず） |
| Q3 | X: 単体試験・結合試験の一部はローカルPC上で実装と試験。結合・総合試験以降をAWS環境で実施を行いたいですが可能でしょうか？ |
| Q4 | A（手元で `npm run verify`、人の確認のあと dev で `npm run smoke`） |
| Q5 | B（先にテストを書く: TDD） |
| Q6 | A（アプリのロジックに 80%。CDK は構成のテストで確認） |
| Q7 | B（E2E テストを push のたびに CI で動かす） |
| Q8 | A（AWS の環境は dev の 1 つ） |
| Q9 | A（人が確認してから手元でデプロイ） |
| Q10 | A（git タグを付け、戻すときは 1 つ前のタグを再デプロイ） |
| Q11 | A（frontend / backend / infra に分ける） |
| Q12 | B（名前は英語、コメントは日本語） |
| Q13 | A（新しい決まりは特にない） |

### AI の分析: 判別できない回答・質問・食い違い
- **Q2「1」**: 選択肢の記号ではないため判別できない → Q14 で選び直し
- **Q3 の質問**: 「手元で単体・一部の結合試験、AWS で結合・総合試験」は可能と回答。あわせて、Q3 の本来の問い（最初に細い版を作るか）が未回答 → Q15
- **Q7 ⇔ Q8・Q9**: 「E2E を push のたびに CI で」と「環境は 1 つ・手元から手動デプロイ」が両立しない → Q16

> 💡 教材ポイント: 回答欄に質問を書いても AI-DLC は受け止める。AI は質問に答えたうえで、元の質問の選択を追加質問として聞き直す。

### 回答（2 回目: 追加質問）
| # | 回答 |
|---|---|
| Q14 | A（PR ごとに 1 コミットにまとめる: Squash and merge） |
| Q15 | A（手元で単体・一部の結合試験、AWS の dev で残りの結合・総合試験。最初に細い版を作る） |
| Q16 | A（CI では AWS を使わずに E2E、本物の AWS の E2E はデプロイ後） |

### 回答: **Looks correct**（まとめの確認）
→ 担当エージェントに、回答をもとに 4 つの成果物を仕上げるよう依頼（統合: Lead Integration）。

| 観点 | 決まったこと |
|---|---|
| 進め方 | 毎回 PR を作り、Squash and merge で main に取り込む |
| 最初の細い版 | 作る（ログイン → 写真 1 枚の報告 → 依頼元が承認） |
| テスト | TDD。手元で単体・一部の結合、AWS の dev で残りの結合・総合。カバレッジ 80%（アプリのロジック）。CI で AWS なしの E2E |
| デプロイ | dev の 1 環境。人の確認のあと手元から。git タグで戻す |
| コード | frontend / backend / infra。名前は英語、コメントは日本語 |

### 成果物（担当エージェントが統合）
- `inception/practices-discovery/team-practices.md` — 5 つの観点（進め方・最初の細い版・テスト・デプロイ・コードの書き方）を「私たちは〜する」の形で記述。`**Integration branch**: main`、`**Methodology**: tdd`、`**Ordering**`（Red → Green → Refactor）を含む
- `inception/practices-discovery/discovered-rules.md` — 新しい「必ず守る／絶対にしない」はなし（`None.`）
- `inception/practices-discovery/evidence.md` — 調べたもの、回答の決定表、食い違い 3 件の解き方、残る不確かさ
- `inception/practices-discovery/practices-discovery-timestamp.md` — 確認した日時とコミット

### 承認ゲート
選択肢: **Approve**（team.md に書き込んでから Requirements Analysis へ）／ **Request Changes**

### 判断: **Approve**
- 承認と同時に、決まった進め方が `aidlc/spaces/default/memory/team.md` の 5 つの節（Way of Working / Walking Skeleton / Testing Posture / Deployment / Code Style）に書き込まれた（PRACTICES_AFFIRMED）。新しい Mandated / Forbidden はないので project.md は変わらない。
- 進捗: 28 ステージ中 7 完了。次は **Requirements Analysis**（要件分析）。

> 💡 教材ポイント: Practices Discovery は、承認した内容がそのまま「以降のすべてのステージが読むルール」（team.md）になる点が他のステージと違う。書き込みは AI が直接ファイルを編集するのではなく、専用のコマンド（practices-promote）が行い、失敗したら承認自体が成立しない。

## 2. Requirements Analysis（要件分析）

担当エージェント: Product Agent（プロダクトマネージャー役。会話の中で AI が担当する inline 方式）／ レビュー役: Product Lead Agent（advisory）

最初の版で「アプリが何をするか」を、テストで合否を判定できる要件（機能要件 FR・非機能要件 NFR）にする。ID（`FR1`、`FR1.2`、`NFR3` など）は、以降の設計・実装・テストで使う追跡用の番号になる。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements-analysis-questions.md`

これまでに決まったことは聞き直さず、まだ決まっていない点と、自分の現場の事情に関わる点だけを質問にしている。

| # | 質問 |
|---|---|
| Q1 | 1 件の報告をどの依頼元が確認するか（2 組織の役割） |
| Q2 | アカウントを誰が作るか |
| Q3 | 写真はその場で撮ったものだけにするか（不正対策） |
| Q4 | 交付金の実績報告の項目（F13） |
| Q5 | 重複の疑いとする「近さ」（距離・時間） |
| Q6 | 却下の理由の選択肢（画面案のレビュー R-08） |
| Q7 | 下書きを残す場所（画面案のレビュー R-09） |
| Q8 | 報告と写真の保存期間 |
| Q9 | 試験運用で使うスマホとブラウザ |
| Q10 | 確認待ちの案内を出すまでの日数（仮の 7 日） |

> 💡 教材ポイント: AI は「例外的な状況のチェックリスト」（corner checklist: 空の一覧、二重送信、通信の失敗、セッション切れなど）を画面や機能ごとに当てはめる。妥当な既定値で決められるものは質問にせず、要件か「仮定」として書く。質問にするのは、自分の現場の事情など、AI には分からないことだけ。

### 回答（1 回目）
| # | 回答 |
|---|---|
| Q1 | A（2 組織ともすべての報告を見られ、どちらが承認・却下してもよい） |
| Q2 | B（ハンターも依頼元も管理者が作って招待） |
| Q3 | C（保存済みの写真も自由に選べる） |
| Q4 | A（交付金の項目は提案どおり） |
| Q5 | A（同じ種類・半径 1 km 以内・24 時間以内） |
| Q6 | A（却下の理由 4 つ: 重複の疑い／写真が不十分／対象の地域・種類ではない／その他〈自由記入〉） |
| Q7 | C（下書きは残さない） |
| Q8 | A（試験運用が終わるまで保存し、終了後に削除） |
| Q9 | A（iPhone Safari・Android Chrome の最新と 1 つ前、依頼元は Chrome・Edge） |
| Q10 | A（7 日） |

### AI の分析: 食い違い
- **Q3「保存済みの写真も自由に」⇔ 一番の課題（重複・不正）と F2「位置・日時の自動取得」** → Q11
- **Q7「下書きは残さない」⇔ 承認済みの画面案（R-06 の修正で「下書きとして残す」）** → Q12

> 💡 教材ポイント: 前のステージで承認した内容（画面案）と食い違う回答が出たときも、AI は黙ってどちらかに合わせず、「前の決定を変えるのか」を聞き直す。

### 回答（2 回目: 追加質問）
| # | 回答 |
|---|---|
| Q11 | X: 保存済みの写真も選べる。写真の撮影日時・位置がなければ画面は空白で表示され手入力となる。 |
| Q12 | A（画面案を変える。「送るのをやめる」で確認のうえ内容を消す） |

### 回答: **Looks correct**（まとめの確認）
AI がまとめで補った点（Q11 の回答だけでは決まらない部分）: 位置の手入力は地図で指す／手入力の報告には依頼元に「手入力」の印／2 人の依頼元がほぼ同時に操作したら先に確定した方を有効にする。

### 成果物
- `inception/requirements-analysis/requirements.md`
  - 機能要件 FR1〜FR12（サブ要件 62 件）、非機能要件 NFR1〜NFR14
  - 制約、仮定 A-1〜A-6、範囲外、未解決の点 OQ-1〜OQ-4
  - 主な要件に Given/When/Then の受け入れ基準（例: 重複の判定の境界〈800 m・24 時間・種類違い〉）
- `inception/requirements-analysis/traceability.json` — 全 ID（74 件）の一覧。以降のステージはこの ID で追跡する

> ⚠️ ハマりどころ: traceability.json をシェルのスクリプトで書き出したところ、レビューの依頼が「この出力ファイルの書き込みが記録されていない」と拒否された。AI-DLC は、ファイルの書き込みをフック（Write ツール）で記録し、「まとめの確認のあとに書かれたか」を確かめている。成果物はエディタ（Write ツール）で書き直すと通る。

### レビュー（Product Lead Agent・advisory）
結果: **NOT-READY**（Major 5・Minor 3）。レビュー記録は `inception/requirements-analysis/reviews/review-01.md`。

| ID | 重大度 | 指摘 |
|---|---|---|
| R-01 | Major | 「成獣／幼獣・捕獲の方法」を 1 画面にすると大きなボタンが 5 個になり、NFR7「1〜3 個」と矛盾 |
| R-02 | Major | 種類の自動判別に合否の基準（確信度のしきい値・目標正答率）がない |
| R-03 | Major | 手入力の日時・位置に検証の規則がなく、値をずらすだけで重複の検出を避けられる |
| R-04 | Major | 管理者が作るアカウントの初期パスワード・再設定・無効化の扱いがない |
| R-05 | Major | 「数秒間」（取り消し）・「ほぼ同時」に測れる値がない |
| R-06 | Minor | ほぼ同時に送られた同じ個体を検出できない。距離の計算方法がない |
| R-07 | Minor | 認証の有効期限、写真の位置情報の扱い、HEIC、監査記録の保存期間など |
| R-08 | Minor | クマの胸の写真が必須か、同意の撤回の扱い |

> 💡 教材ポイント: advisory のレビューは NOT-READY でも止まらず、承認するかどうかは人が決める。Approve すると指摘は「受け入れたリスク」として残り、一部だけ直すよう頼むこともできる。

### 承認ゲート
選択肢: **Approve**（User Stories へ。指摘はリスクとして受け入れる）／ **Request Changes**

### 判断: **Request Changes**
→ AI が「何を直しますか？」と聞き返した。

### 回答: **R-01〜R-08 をすべて直す**
具体的な値は AI が妥当な初期値で決め、仮定（A-7〜A-12）として明記した:
- R-01: 「成獣／幼獣」（2 ボタン）と「捕獲の方法」（3 ボタン）を別の画面に分けた。ステップは通常 7、クマのときは 8
- R-02: 確信度 80% 以上で「判別できた」。捕獲後の写真 30 枚以上で正答率 70% 以上を目標（FR3.5）
- R-03: 捕獲日時は「未来ではない・7 日前まで」、場所は「管理者が設定した対象地域の中」（FR2.14）。ずらして検出を避ける手口は依頼元の目視に頼ると仮定 A-2 に明記
- R-04: 仮のパスワードを手渡し、初回に変更。管理者による再設定、無効化の効果（1 時間以内に使えなくなる、報告は残る）（FR1.8・FR10.3・FR10.4）
- R-05: 取り消しは 10 秒・本人だけ。承認・却下は「確認中」のときだけサーバーが受け付ける（先着）
- R-06: 距離は大円距離（誤差 1 m）。保存後にもう一度確かめ、ほぼ同時の 2 件にも印（FR6.4）
- R-07: ログインは 30 日保つ。写真の位置は全身→尻尾の順に読む。送る前に長辺 2,048 px の JPEG に縮小。監査の記録は報告と同じ期間保存
- R-08: クマの胸の写真は「撮れなかった」で先に進める（FR2.13）。同意の取り消しは管理者に連絡（FR10.5）

修正で成果物が変わったので、もう一度レビューを実行。

### 再レビュー結果: **READY**
- R-01〜R-08 はすべて解決（Resolved）。
- 新しい指摘 Minor 2 件:
  - R-09: 7 日を過ぎて送れない報告の扱い（管理者の例外対応や紙に戻るなど）が書かれていない
  - R-10: FR1.8 が FR1.7 より前に置かれている（並び順だけ）

### 承認ゲート（2 回目）

### 判断: **Approve**
- R-09・R-10 はリスクとして受け入れた。
- 進捗: 28 ステージ中 8 完了。次は **User Stories**（ユーザーストーリー）。

> 💡 教材ポイント: 1 回目の NOT-READY のあと「すべて直す」を選び、具体的な値は AI が初期値を決めて「仮定」として明記した。値を人がすべて決めなくても、仮定として書いておけば後で見直せる。

## 3. User Stories（ユーザーストーリー）

担当エージェント: Product Agent（実行方式は mob。本来は設計・開発・品質の 3 エージェントが同時に下書きを確認するが、collaborators が off のため担当 1 人で進める）／ レビュー役: Product Lead Agent（advisory）

### AI の判断: ストーリーを作るか
`inception/user-stories/user-stories-assessment.md` — **Execute（作る）**。理由: 利用者に見える機能が中心、利用者が 3 種類、業務の決まり（重複・同時の確認・取り消し）が複雑、TDD で受け入れ基準がそのままテストの元になる。

> 💡 教材ポイント: User Stories は条件付きのステージ。AI は最初に「このプロジェクトにストーリーが必要か」を判断し、理由を文書に残す（不要なら理由付きでスキップする）。

### AI が作った質問ファイル（ストーリーの計画）
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/user-stories/user-stories-questions.md`

計画の案: 人物像 3 人、利用者の流れごとに US1〜US7、ストーリー 25〜30 個、各 3〜6 個の受け入れ基準。

| # | 質問 |
|---|---|
| Q1 | 人物像（ペルソナ）を何人にするか |
| Q2 | ストーリーの分け方（流れごと／人物像ごと／作る順番ごと） |
| Q3 | 最初の細い版に入るストーリーに印を付けるか |
| Q4 | 管理者の操作をどこまで画面で作るか |

### 回答
| # | 回答 |
|---|---|
| Q1 | A（人物像 3 人: 高齢のハンター・依頼元の担当者・管理者） |
| Q2 | A（利用者の流れごとに US1〜US7） |
| Q3 | A（最初の細い版のストーリーに印を付け、細い版用の割り切ったストーリーを別に用意） |
| Q4 | A（管理者用の画面を作り、すべての操作を画面から） |

### 回答: **Looks correct** → 成果物
- `inception/user-stories/personas.md` — 人物像 3 人（P1 高齢のハンター、P2 依頼元の担当者、P3 管理者）と関係図
- `inception/user-stories/stories.md` — ストーリー 37 個（US1.1〜US7.2）、受け入れ基準（AC）は各 2〜5 個。最初の細い版の印 🦴 は 6 個（US1.1・US2.1・US4.1〜US4.3・US5.1）
- `inception/user-stories/traceability.json` — 要件 70 件とストーリーの対応表。機能要件はすべて OK、非機能要件の一部は NFR Requirements・Refined Mockups に回す（Deferred）。対応表の検査（traceability sensor）は合格

> 💡 教材ポイント: traceability.json の骨組みは AI-DLC のコマンド（`sensor-traceability --write-upstream`）が作り、上流の要件 ID をすべて「GAP（未対応）」で並べる。AI はそれを埋め、1 件でも GAP が残るとレビューに進めない。

### レビュー（Product Lead Agent・advisory）
結果: **READY**（Major 2・Minor 9）。レビュー記録は `inception/user-stories/reviews/review-01.md`。
- Major R-01: 7 日・未来 5 分の境界を「送信の時点」とサーバー側でも確かめる AC がない
- Major R-02: 撮影日時がない写真の AC がない（位置がない場合だけ）
- Minor R-03〜R-11: 二重送信の AC の引き継ぎ、15 MB の境界、ハンターが承認 API を直接呼ぶ場合、絞り込み・却下理由・却下の取り消し、細い版の AC の依存、初回ログインの順番、操作の記録の画面の出典、人物欄のずれ、Should の類似度の基準

### 承認ゲート
選択肢: **Approve**（Refined Mockups へ。指摘はリスクとして受け入れる）／ **Request Changes**

### 判断: **Approve**
- R-01〜R-11 はリスクとして受け入れた（受け入れ基準の細部は、Functional Design・Code Generation のテスト設計で補う）。
- 進捗: 28 ステージ中 9 完了。次は **Refined Mockups**（画面案の仕上げ）。

## 4. Refined Mockups（画面案の仕上げ）

担当エージェント: Design Agent（デザイナー役。inline）／ レビュー役: Product Lead Agent（advisory）

Ideation のラフな画面案を、要件とストーリーに合わせて「作る人が迷わない」細かさに仕上げる。成果物は画面案、操作の仕様、デザインシステムとの対応、アクセシビリティのチェックリスト。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/refined-mockups/refined-mockups-questions.md`

| # | 質問 |
|---|---|
| Q1 | 部品集（コンポーネントライブラリ）とフレームワーク |
| Q2 | 基本の色（テーマカラー） |
| Q3 | ダークモードに対応するか |
| Q4 | 画面の幅による切り替え（ブレークポイント） |
| Q5 | 依頼元・管理者側の文字とボタンの大きさ |
| Q6 | 日時・場所を手で入れる画面の操作 |

### 回答
すべて A: React ＋ MUI ／ 森の緑 ／ ダークモードなし ／ 3 段階のブレークポイント ／ 依頼元・管理者は文字 16px・ボタン 40〜48px ／ 日時は「今日」「昨日」ボタン、場所は「今いる場所」＋地図をタップ。

### 回答: **Looks correct** → 成果物
- `inception/refined-mockups/mockups.md` — ハンター側 H1〜H9（H1a パスワード変更、H5b 成獣／幼獣、H5c 捕獲の方法、H6a・H6b 手入力、H-X やめる確認を追加）、依頼元側 R1〜R3、管理者側 A1〜A5。ラフな画面案からの変更点 9 つを冒頭に一覧
- `inception/refined-mockups/interaction-spec.md` — 報告の作成と確認の流れ（Mermaid 図）、部品 8 つの仕様（状態・入力・幅ごとの動き・アクセシビリティ）
- `inception/refined-mockups/design-system-mapping.md` — 色（森の緑 `#1B5E20` など、コントラスト比つき）、文字、幅の区切り、画面の部品と MUI の部品・アイコンの対応
- `inception/refined-mockups/accessibility-checklist.md` — WCAG 2.1 AA の確認項目 24 個と確かめ方（自動・手動・デザイン）

> 💡 教材ポイント: Rough Mockups（Ideation）は「何をどの順で見せるか」、Refined Mockups（Inception）は「作る人が迷わない細かさ」。要件で増えた画面（成獣／幼獣など）と、要件で変わった決定（下書きをなくす）が、ここで画面案に反映される。

### レビュー（Product Lead Agent・advisory）
結果: **READY**（Major 2・Minor 9）。レビュー記録は `inception/refined-mockups/reviews/review-01.md`。
- Major R-01: 1/7 で「戻る」を出さない仕様が FR2.1・H3 の図と食い違う
- Major R-02: NFR7「大きなボタン 1〜3 個」の数え方（選択肢・[次へ]・[直す] を含めるか）が未定
- Minor R-03〜R-11: 依頼元側のボタン 40px と 44px の基準、判別結果が遅れて届いたとき、カメラで撮った写真の位置情報、7 日の判定と日付の部品、ログイン切れ・管理者の入口、細い版の画面構成、絞り込みと承認、10 秒の取り消しの根拠、管理者の画面の詳細

### 承認ゲート
選択肢: **Approve**（Domain Design へ。指摘はリスクとして受け入れる）／ **Request Changes**

### 判断: **Approve**
- R-01〜R-11 はリスクとして受け入れた（画面の細部は Functional Design・Code Generation で詰める）。
- 進捗: 28 ステージ中 10 完了。次は **Domain Design**（業務のモデルの設計）。

## 5. Domain Design（業務のモデルの設計）

担当エージェント: Architect Agent（アーキテクト役。inline）／ レビュー役: Architecture Reviewer Agent（advisory）

システムを「自分たちで書くプログラムの部品」（コンポーネント）に分け、各部品が持つデータ（エンティティ）と呼び出し方を決める。データベースや AWS のサービスは部品ではなく「部品が使う外部のもの」。どこに配置するか（サーバーの形）は次の Units Generation で決める。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/domain-design/domain-design-questions.md`

部品の案: Accounts ／ Reporting ／ SpeciesDetection ／ DuplicateDetection ／ Review ／ Settings ／ AuditLog ／ WebApp

| # | 質問 |
|---|---|
| Q1 | 報告の「状態」をどの部品が持つか |
| Q2 | 種類の判別と重複の判定を報告の部品から分けるか |
| Q3 | 操作の記録をどう集めるか（イベント／直接呼ぶ／各自） |
| Q4 | 保存後の重複の再判定の動かし方 |
| Q5 | 画面を 1 つのアプリにするか 3 つに分けるか |
| Q6 | 試験運用の終わりのデータ削除をどの部品が行うか |

> 💡 教材ポイント: Domain Design は「部品の境目」と「データの持ち主」を決めるステージ。1 つのデータの持ち主は必ず 1 つの部品に決める（持ち主があいまいなのは設計の悪い兆し）。

### 回答
| # | 回答 |
|---|---|
| Q1 | A（Review が状態を持ち、Reporting は内容だけ） |
| Q2 | A（種類の判別と重複の判定を分ける） |
| Q3 | A（知らせ〈イベント〉で AuditLog に集める） |
| Q4 | A（送信前はその場、保存後は知らせで再判定） |
| Q5 | B（ハンター用・依頼元用・管理者用の 3 つの Web アプリに分ける） |
| Q6 | A（データを持つ各部品が自分のデータを消す） |

AI が補った点: Q5 で 3 つに分けたため、共通の画面部品とテーマを UiKit にまとめて共有する。

### 回答: **Looks correct** → 成果物
- `inception/domain-design/components.md` — 部品 11 個（Accounts、Reporting、SpeciesDetection、DuplicateDetection、Review、Settings、AuditLog、UiKit、HunterApp、RequesterApp、AdminApp）とデータ 9 個。前半は機械が読む YAML、後半は図と表
- `inception/domain-design/decisions.md` — 設計の決定記録（ADR）6 件。各 ADR に背景・決定・結果・選ばなかった案
- `inception/domain-design/traceability.json` — ストーリー 37 個と部品・データの対応。検査は合格

> 💡 教材ポイント: components.md の YAML には決まりがある（名前は一意、A が B を呼ぶなら B の「呼ばれる側」に A を書く、呼び出しに輪を作らない、データの持ち主は 1 つ）。AI は書いたあとにスクリプトでこの決まりを確かめた。重複の判定が報告の部品を呼び返すと輪ができるため、判定用の索引（ReportFootprint）を重複の部品が自分で持つ設計にした（ADR-003）。

### レビュー（Architecture Reviewer Agent・advisory）
結果: **NOT-READY**（Major 4・Minor 4）。レビュー記録は `inception/domain-design/reviews/review-01.md`。

| ID | 重大度 | 指摘 |
|---|---|---|
| R-01 | Major | 送信前の写真の受け取りと種類の判別を、どの部品がどの順で行うかが未定（下書きなしなのに写真と判別結果が報告より先にできる） |
| R-02 | Major | 却下を取り消したとき、重複の索引を有効に戻す知らせがない（取り消された報告が以後の判定から漏れる） |
| R-03 | Major | 役割による制限（NFR4）を各部品がどう確かめるかの経路がない |
| R-04 | Major | 依頼元の一覧（3 部品のデータで絞り込み＋50 件のページ分け）を誰が組み立てるかが未定 |
| R-05 | Minor | 種類の判別の結果の削除の持ち主 |
| R-06 | Minor | ハンターの画面が対象地域を読む道がない |
| R-07 | Minor | 呼び出しと知らせが 1 行に混ざっている。知らせが失われたときの影響 |
| R-08 | Minor | MUI やコードの置き場所は、このステージの範囲外 |

> 💡 教材ポイント: 設計のレビュー役（Architecture Reviewer）は、部品の「つなぎ目」を細かく追う。今回の Major はすべて、部品と部品の間（写真→判別→報告、取り消し→重複の索引、認可、一覧の組み立て）で起きている。

### 承認ゲート
選択肢: **Approve**（Units Generation へ。指摘はリスクとして受け入れる）／ **Request Changes**

### 判断: **Request Changes**
→ AI が「何を直しますか？」と聞き返した。

### 回答: **R-01〜R-08 をすべて直す**
AI が設計を修正し、決定記録に ADR-007〜ADR-010 を追加:
- R-01（ADR-009）: 写真は報告より先に Reporting が受け付け、全身の写真なら判別を頼む。送信のときに報告と結び付ける。24 時間たっても結び付かない写真は判別の結果ごと消す
- R-02（ADR-003 を更新）: 却下を取り消したら「却下が取り消された」知らせを送り、重複の索引に戻す
- R-03（ADR-007）: ログインの証明に役割を入れ、各部品の API の入口で確かめる（Accounts を毎回呼ばない）
- R-04（ADR-010）: 読み出し専用の部品 **ReportCatalog** を追加。3 つの部品の知らせから一覧を組み立て、絞り込みと 50 件のページ分けを受け持つ
- R-05: 種類の判別の結果の削除を SpeciesDetection の責務にし、管理者の画面から呼ぶ
- R-06: ハンターの画面は対象地域を Reporting 経由で読む
- R-07（ADR-008）: 呼び出しと知らせを別の行に分け、知らせが失われたときの影響を表にして NFR Design に引き継ぐ
- R-08: MUI は Refined Mockups の決定を出典として明記、コードの置き場所は Units Generation に移した

部品は 11 個 → 12 個。修正で成果物が変わったので、もう一度レビューを実行。

### 再レビュー結果: **READY**
- R-01〜R-08 はすべて解決（Resolved）。
- 新しい指摘 Minor 2 件:
  - R-09: 一覧の行のハンター名・地名を、どの知らせに載せるかが未定
  - R-10: 部品どうしの呼び出し（知らせで動く処理を含む）で、ログインの証明をどう渡すかが未定

### 承認ゲート（2 回目）
選択肢: **Approve** ／ **Request Changes**

### 判断: **Request Changes**（2 回目）→ 回答: **R-09 と R-10 を両方直す**
- R-09（ADR-012）: 「報告が保存された」知らせの中身を決めた。ハンターの表示名は Reporting が同意の確認のときに Accounts から受け取って載せる。地名は Reporting が保存のときに地図のサービスで緯度・経度から求める（求められないときは緯度・経度を表示）
- R-10（ADR-011）: 部品どうしのその場の呼び出しでは、利用者のログインの証明をそのまま渡し、呼ばれた側も役割を確かめる。知らせには操作した利用者の ID を載せ、受け手は MonsterNote の部品が送った知らせだけを受け付ける

修正で成果物が変わったので、3 回目のレビューを実行。

### 3 回目のレビュー結果: **READY**
- R-09・R-10 は解決（Resolved）。
- 新しい指摘 Minor 1 件: R-11 Reporting と Accounts の呼び出しの説明に「表示名の受け取り」が書かれていない（説明文の追記だけ）

### 承認ゲート（3 回目）
選択肢: **Approve** ／ **Request Changes**

### 判断: **Request Changes**（3 回目）→ R-11 を直す
Reporting と Accounts の呼び出しの説明の両側に「表示名を受け取る（ADR-012）」を追記。4 回目のレビューを実行。

> 💡 教材ポイント: 説明文 1 行の修正でも、成果物が変わればレビューをやり直す。AI-DLC はレビュー後に成果物が変わったことを検知し、古いレビューのまま承認させない。

### 4 回目のレビュー結果: **READY**
- R-11 は解決。新しい指摘 Minor 1 件: R-12 表示名の用途の書き方が 2 か所で少し違う（意味は同じ。直すかは任意）

### 承認ゲート（4 回目）
選択肢: **Approve** ／ **Request Changes**

### 判断: **Approve**
- R-12 はリスクとして受け入れた。
- 進捗: 28 ステージ中 11 完了。次は **Units Generation**（作業単位の分割）。

> 💡 教材ポイント: Domain Design は Request Changes を 3 回繰り返した（Major 4 件 → Minor 2 件 → Minor 1 件 → 言い回し 1 件）。advisory レビューは直すたびに小さな指摘が出ることがあり、どこで区切るかは人が決める。

## 6. Units Generation（作業単位の分割）

担当エージェント: Architect Agent（inline）／ レビュー役: Architecture Reviewer Agent（advisory）

12 個の部品を「作る単位」（Unit）にまとめ、Unit どうしの依存関係（DAG）を決める。どの順で作るかは Delivery Planning で決める（このステージは「何が何を前提にするか」だけ）。team-practices で細い版を作ると決めたため、1 つ目の Unit は細い版になる。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/units-generation/units-generation-questions.md`

| # | 質問 |
|---|---|
| Q1 | Unit の切り方（機能ごとの縦切り／部品ごとの横切り） |
| Q2 | Unit の数（大きさ） |
| Q3 | AWS への配置の形（1 つの構成／Unit ごと） |
| Q4 | 1 つ目の Unit（細い版）の範囲 |
| Q5 | 依存のない Unit を同時に進めてよいことにするか |

### 回答
| # | 回答 |
|---|---|
| Q1 | A（機能ごとの縦切り。API と画面を 1 つの Unit に） |
| Q2 | B（大きめの 4 個） |
| Q3 | A（全体を 1 つの CDK アプリ、Lambda ＋ 1 つの API の入口） |
| Q4 | A（1 つ目の Unit は細い版） |
| Q5 | A（依存のない Unit は同時に進めてよい） |

AI が補った点: Q2 の B に名前のなかったストーリーを近い Unit に入れた（アカウントの初回の手続き → 管理の Unit、Should → 報告と重複の Unit）。

### 回答: **Looks correct**（まとめの確認）→ **Approve Plan**（分け方の計画の承認）
このステージは、まとめの確認のあとに「分け方の計画」（Unit の数・種類・依存）の承認を別に取る。

### 成果物
- `inception/units-generation/unit-of-work.md` — Unit 4 個（U1 `u1-skeleton`、U2 `u2-report-duplicate`、U3 `u3-review-list`、U4 `u4-accounts-admin`。すべて service）、部品と Unit の対応表
- `inception/units-generation/unit-of-work-dependency.md` — 依存の図と理由、Unit の間のつなぎ目、同時に進められる組み合わせ（U2 と U3）、機械が読む YAML
- `inception/units-generation/unit-of-work-story-map.md` — ストーリー 37 個と Unit の対応、各 Unit の中の作る順
- `inception/units-generation/traceability.json` — 検査は合格

> ⚠️ ハマりどころ: traceability.json の target に「U1, U3」と 2 つの Unit を書いたら、検査で「宣言された Unit ではない」と言われた。このステージの target は Unit 1 つだけ。2 つにまたがるストーリー（US4.1）は、対応表（story-map）に両方を書き、traceability.json には主な Unit（U1）だけを書く。

### レビュー（Architecture Reviewer Agent・advisory）
結果: **READY**（Major 1・Minor 4）。レビュー記録は `inception/units-generation/reviews/review-01.md`。
- Major R-01: U1（細い版）で、同意と従事者番号の確認をどう通すかが書かれていない（その画面は U4 にある）
- Minor R-02〜R-05: U3 のストーリー欄に US4.1 がない、1 つの CDK アプリを U2 と U3 で同時に触ると衝突しやすい、Unit の中の作る順が Delivery Planning の役割に近い、表の言い回し

### 承認ゲート
選択肢: **Approve** ／ **Request Changes**

### 判断: **Request Changes** → 回答: **R-01〜R-05 をすべて直す**
- R-01: U1 では、管理者が手順書で「同意済み・従事者番号の登録済み」のアカウントを作る。同意の確認の決まりは U1 から動かす
- R-02: U3 のストーリー欄に US4.1（絞り込みの部分）を追加
- R-03: U2 と U3 が同時に触る共有の箇所（CDK のスタック、API の定義、知らせの仕組み）を明記。デプロイは Unit ごとではなく全体で行うと明記
- R-04: Unit の中の作る順を「依存の理由があるものだけ」の表にし、目安であると明記
- R-05: 表の言い回しを直した

修正で成果物が変わったので、もう一度レビューを実行。

### 再レビュー結果: **READY**（指摘なし）
- R-01〜R-05 はすべて解決。新しい指摘はなし。

### 承認ゲート（2 回目）
選択肢: **Approve**（Contract Design へ）／ **Request Changes**

### 判断: **Approve**
- 進捗: 28 ステージ中 12 完了。次は **Contract Design**（部品の間の約束の設計）。

## 7. Contract Design（部品の間の約束の設計）

担当エージェント: Architect Agent（inline）／ レビュー役: Architecture Reviewer Agent（advisory）

境目をまたぐ「約束」（契約: どんなデータを、どんな形・方法で渡し、失敗したらどうするか）を決める。約束が先に決まっていれば、U2 と U3 を同時に作っても、つなげたときに食い違わない。境目は「画面アプリ → API」（外との境目）と「部品の間」（呼び出しと知らせ）の 2 種類。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/contract-design/contract-design-questions.md`

| # | 質問 |
|---|---|
| Q1 | 画面アプリが呼ぶ API の形（REST ／ GraphQL） |
| Q2 | 写真のアップロードの道（期限付き URL で直接 ／ API 経由） |
| Q3 | 知らせ（イベント）の形（共通の外側を付けるか） |
| Q4 | 約束の持ち主と置き場所 |
| Q5 | 約束を変えるときの決まり（版の上げ方） |
| Q6 | エラー・時間切れ・やり直しの決まり |

### 回答
すべて A: REST（OpenAPI、`/v1`）／ 写真は期限付き URL で保存場所に直接 ／ 知らせは共通の外側＋ ID で 2 回目を無視（AsyncAPI）／ 提供側が持ち主、仕様は 1 か所、PR で確認 ／ 足すだけはいつでも、消す・意味を変えるは同じ PR、`/v2` は作らない ／ 共通のエラーの形、時間切れ 10 秒・3 秒、報告の送信だけやり直し可。

### 回答: **Looks correct** → 成果物
- `inception/contract-design/contract-summary.md` — 約束 16 個（画面が呼ぶ API 7、部品の間のその場の呼び出し 4、知らせ 4、共通の約束 1）。OpenAPI と AsyncAPI の仕様（YAML 11 ブロック）、エラーの形と状態番号の表、時間切れとやり直しの表、持ち主の決まり、未解決の点

> 💡 教材ポイント: 約束の文書には、各 API が「誰に何を許すか」（403 の条件）と「重複の疑いを 409 で返し、ハンターが確かめたら送り直す」といった業務の流れまで入る。U2 と U3 を同時に作れるのは、この約束どおりの「試験用の代わり」で相手がいなくても試せるから。

### レビュー（Architecture Reviewer Agent・advisory）
結果: **NOT-READY**（Major 3・Minor 5）。レビュー記録は `inception/contract-design/reviews/review-01.md`。

| ID | 重大度 | 指摘 |
|---|---|---|
| R-01 | Major | 利用者のログインの証明がない内部の呼び出し（24 時間後の写真の削除、保存後の再判定での設定の読み出し）の認証の形がない |
| R-02 | Major | 管理者の画面（公開のアプリ）が、外から呼べない内部の道で判別の結果を消すことになっている |
| R-03 | Major | 30 日のログイン保持のための、証明の出し直しの道がない |
| R-04〜R-08 | Minor | 409 の詳細を返す場所、知らせの順番の入れ替わり、送信前の重複の知らせの reportId、送信の時間の合計と同時のやり直し、ログインの道と管理者の削除の 401・403 |

### 承認ゲート
選択肢: **Approve** ／ **Request Changes**

### 判断: **Request Changes** → 回答: **R-01〜R-08 をすべて直す**
- R-01: 「部品の身元の証明」を追加。利用者がいない処理で使ってよい呼び出しを表で 2 つに限定（24 時間後の写真の削除、保存後の再判定での設定の読み出し）
- R-02: 判別の結果の全削除を管理者向けの公開の道（C17 `/v1/admin/detection-data`）に移し、管理者の画面は内部の道を呼ばないと明記
- R-03: 証明の出し直しの道（`POST /v1/session/refresh`）を追加。出し直し用の値は最後の利用から 30 日、無効のアカウントには 401
- R-04: エラーの形に 409 の詳細（`conflict`）を追加
- R-05: 知らせの順番が入れ替わったときの決まり（新しいものだけを反映、先に届いた状態は覚えておく）を追加
- R-06: 重複の疑いの知らせは保存後だけ、組ごとに 2 つ送ると明記
- R-07: 部品の間の呼び出しを 1 回 2 秒・合計 6 秒に、同じ送信の処理中は 409 で 2 秒後に送り直す
- R-08: ログインと出し直しは Bearer なし、管理者の道はすべて 401・403 を返すと明記

修正で成果物が変わったので、もう一度レビューを実行。

### 再レビュー結果: **READY**
- R-01〜R-08 はすべて解決。新しい指摘 Minor 2 件:
  - R-09: 保存後の再判定で設定の読み出しが時間切れになったときの扱いが未定
  - R-10: 知らせの送り手の一覧に、送り手にならない AdminApp が入っている

### 承認ゲート（2 回目）
選択肢: **Approve** ／ **Request Changes**

### 判断: **Request Changes**（2 回目）→ 回答: **R-09 と R-10 を両方直す**
- R-09: 保存後の再判定で設定の読み出しが失敗したら、処理を失敗として終え、知らせの再送に任せる（古い設定や既定値で代わりに判定しない）。再送の回数は NFR Design で決める
- R-10: 知らせの送り手の一覧から AdminApp を外し、画面アプリは知らせを送らないと明記

3 回目のレビューを実行。

### 3 回目のレビュー結果: **READY**（指摘なし）
- R-09・R-10 は解決。未解決の指摘はなし。

### 承認ゲート（3 回目）
選択肢: **Approve**（Delivery Planning へ）／ **Request Changes**

### 判断: **Approve**
- 進捗: 28 ステージ中 13 完了。次は **Delivery Planning**（作る順と計画）。

## 8. Delivery Planning（作る順と計画）

担当エージェント: Delivery Agent（デリバリーリード役。inline）／ レビュー役: なし

作る順番を決める。作る単位は **Bolt**（1 つ以上の Unit をまとめ、動くものができるところまで一通り作る 1 回分の作業）。Units Generation は「何が何を前提にするか」（依存の形）、Delivery Planning は「どの順で作るか」（価値とリスクの判断）を受け持つ。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/inception/delivery-planning/delivery-planning-questions.md`

| # | 質問 |
|---|---|
| Q1 | 細い版のあと、U2 と U3 のどちらを先に作るか |
| Q2 | 点数を付ける方法（WSJF）で順番を決めるか |
| Q3 | 1 つの Bolt の大きさ（U2 を Must と Should に分けるか） |
| Q4 | Bolt を同時に進めるか、1 つずつか |
| Q5 | 種類の判別の精度を確かめる試験用の写真をどう集めるか |
| Q6 | 一番心配なこと |

### 回答（1 回目）
| # | 回答 |
|---|---|
| Q1 | A（細い版のあと U2 を先に） |
| Q2 | A（点数は付けず、理由を文章で） |
| Q3 | A（U2 を Must と Should の 2 Bolt に分け、合計 5 Bolt） |
| Q4 | B（U2 と U3 を同時に進める） |
| Q5 | C（試験用の写真は集めず、試験運用で確かめる） |
| Q6 | C（一番の心配は AWS の費用） |

### AI の分析: 食い違い
- **Q1「U2 を先に」⇔ Q4「U2 と U3 を同時に」** → Q7
- **Q5「試験用の写真を集めない」⇔ 承認済みの要件 FR3.5（30 枚以上で Build and Test で確かめる）** → Q8

### 回答（2 回目: 追加質問）
| # | 回答 |
|---|---|
| Q7 | A（U2 と U3 を同時に進める。U2 の中で判別と重複を先に） |
| Q8 | B（精度は試験運用で確かめる。要件 FR3.5 の確かめる時期を試験運用に変更） |

### 回答: **Looks correct** → 設定の変更と成果物
- Construction の進め方を変更: Unit ごと（unit-major）→ **ステージごと（stage-major）**、コードの生成を **同時に（swarm）**
- `inception/delivery-planning/bolt-plan.md` — Bolt 5 つ（Bolt 1 細い版 → Bolt 2〈U2 Must〉と Bolt 3〈U3〉を同時に → Bolt 4〈U2 Should〉・Bolt 5〈U4〉）、各 Bolt の完了の条件・確かめること・見せるもの、要件の変更（FR3.5）
- `inception/delivery-planning/team-allocation.md` — すべての Bolt を AI の開発者エージェントが作り、開発者本人が確認
- `inception/delivery-planning/risk-and-sequencing-rationale.md` — 順番の理由（細い版を最初に、価値とリスクを早く、同時に進める）、リスクと確かめる Bolt
- `inception/delivery-planning/external-dependency-map.md` — 外部への依存 8 件（地図のサービス、交付金の書式、試験運用の参加者など）
- `verification/phase-check-inception.md` — Inception の最終確認。対応表 3 つすべて GAP・ORPHAN なしで **合格**

### 検証のコマンド: `npm run verify` → **Approve**
Construction で各 Unit が完成したことを確かめるコマンド。手元の検査・型・テスト・AWS なしの E2E・カバレッジを実行する。AWS の dev での確認は、デプロイに人の承認が要るため含めない。

> 💡 教材ポイント: 検証のコマンドは「人が承認した 1 行のコマンド」として記録され（ハッシュ付き）、Construction のすべての確認で同じものが使われる。AI が勝手に別のコマンドに変えることはできない。

### 承認ゲート
選択肢: **Approve**（Functional Design〈Construction〉へ）／ **Request Changes**

### 判断: **Approve**
- 進捗: 28 ステージ中 14 完了。**Inception フェーズ完了**。次は Construction の **Functional Design**（→ 05-construction.md）。

## Inception のまとめ

| # | ステージ | 結果 | 主な成果物 |
|---|---|---|---|
| 1 | Practices Discovery | Approve | team-practices.md（→ team.md に反映） |
| 2 | Requirements Analysis | Request Changes ×1 → Approve | requirements.md（FR1〜FR12・NFR1〜NFR14） |
| 3 | User Stories | Approve | stories.md（37 ストーリー）、personas.md |
| 4 | Refined Mockups | Approve | mockups.md、interaction-spec.md など |
| 5 | Domain Design | Request Changes ×3 → Approve | components.md（部品 12）、decisions.md（ADR 12 件） |
| 6 | Units Generation | Request Changes ×1 → Approve | unit-of-work.md（Unit 4） |
| 7 | Contract Design | Request Changes ×2 → Approve | contract-summary.md（約束 17） |
| 8 | Delivery Planning | Approve | bolt-plan.md（Bolt 5）、phase-check-inception.md |
