# 05. Construction（作る）

## ゴール

Inception で決めた設計と計画にしたがって、Unit（作る単位）ごとに詳細設計・コード・テストを作り、AWS の dev 環境で動かす。この章でも、各ステージの質問・回答・承認の判断を記録する。

## 記録の読み方

- **AI の質問** … AI-DLC が作った質問ファイルや、チャットで出した選択肢
- **回答** … 自分が選んだ答え（質問ファイルを直接編集）
- **承認ゲート** … ステージが終わったときの判断（Approve / Request Changes など）と、その理由

## 0. Construction の始まり

### AI の質問: 誰が作るか
「Inception が終わり、計画には Unit が 4 つあります。誰が作りますか？」

### 回答: **Just me**（このセッションが、ステージごとに Unit を作る）

### 最初の細い版（walking skeleton）の扱い
AI-DLC は、チームのルール（team.md の Walking Skeleton）を読み、「最初に細い版を作る」チームであることを確認した（skeleton stance: on）。そのため、Delivery Planning で「ステージごとに進める」と決めていても、**最初の Unit（U1 細い版）だけは、設計からコードの生成まで先に通し、dev で動くことを人が確かめて承認してから**、ほかの Unit に進む。

> 💡 教材ポイント: Construction のステージ（Functional Design、NFR Requirements、NFR Design、Infrastructure Design、Code Generation）は Unit ごとに行う。「ステージごとに進める」（stage-major）なら、1 つのステージを全 Unit で終えてから次のステージに進み、承認はステージごとに 1 回。ただし細い版の Unit は例外で、先に最後まで通す。

## 1. Functional Design（機能の詳細設計）— U1 `u1-skeleton`

担当エージェント: Architect Agent（inline）／ レビュー役: Architecture Reviewer Agent（**adversarial**: 指摘が残る限り直すまで通さない、最大 2 回）

U1 の業務の決まり（rules.md）、データの形（entities.md）、処理の流れと状態の移り変わり（functional-spec.md）、画面の部品（frontend-components.md）を決める。プログラムの書き方はまだ決めない。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/functional-design/functional-design-questions.md`

細い版なので、後の Unit で完全な形にする部分を「U1 でどこまで作るか」を確かめる質問。

| # | 質問 |
|---|---|
| Q1 | U1 の報告で記録する項目の範囲 |
| Q2 | U1 の捕獲日時・捕獲場所の決め方（写真の撮影情報はまだ読まない） |
| Q3 | 写真のアップロードを最終の形で作るか |
| Q4 | 承認に、取り消し・先着の決まりをどこまで入れるか |
| Q5 | 手順書でアカウントを作る方法 |
| Q6 | 依頼元の一覧をどこまで作るか |

### 回答
すべて A: U1 は写真 1 枚・種類・雌雄・日時・位置・従事者番号だけ（U2 の項目は空を許す）／ 日時と位置は送信の時点のスマホ ／ 写真は最終の形（期限付き URL）で、判別は呼ばない ／ 承認だけ、取り消しなし、先着の決まりは U1 から ／ アカウントはスクリプトで作る ／ 一覧は新しい順・50 件・ページ送りまで。

### 回答: **Looks correct** → 成果物
- `construction/u1-skeleton/functional-design/entities.md` — データ 5 つ（Account・Photo・Report・ReviewDecision・ReportListItem）。U2 で足す項目には「U1 では空」と注記
- `construction/u1-skeleton/functional-design/rules.md` — 業務の決まり 24 個（BR1 ログインと役割、BR2 写真と報告、BR3 確認、BR4 一覧、BR5 アカウントのスクリプト、BR6 写真の表示）。各決まりに「いつ・どう判断し・違反したら何を返すか・出典（FR／NFR）」
- `construction/u1-skeleton/functional-design/functional-spec.md` — 流れ 7 つ（ログイン、写真 1 枚の報告、一覧と詳細、承認、ハンターの一覧、知らせの処理、スクリプト）、状態の移り変わり（Mermaid）、角のケースの表
- `construction/u1-skeleton/functional-design/frontend-components.md` — 画面の構成、部品 10 個、画面が持つ状態、API とのつなぎ
- `construction/u1-skeleton/functional-design/traceability.json` — 受け入れ基準 22 個と業務の決まりの対応。他の Unit が受け持つもの（AC4.1.2 → U3、AC4.2.2 → U2）は N/A。検査は合格

> ⚠️ ハマりどころ: rules.md の YAML の値に「理由: 形式」と全角の文字の前に半角のコロンを書いたら、YAML として読めなくなった（`mapping values are not allowed here`）。値の中に「: 」を書かないか、引用符で囲む。

### レビュー（Architecture Reviewer Agent・**adversarial**）
1 回目の結果: **NOT-READY**（Major 4・Minor 3）。レビュー記録は `construction/u1-skeleton/functional-design/reviews/review-01.md`。

| ID | 重大度 | 指摘 |
|---|---|---|
| R-01 | Major | 送信の確認の順番が「写真 → 送信のキー」のため、保存に成功したあとの「もう一度」が 422 になり、同じ報告を返せない |
| R-02 | Major | ハンターが自分の報告の状態だけを読む決まりに、確認の記録の側に「誰の報告か」がない |
| R-03 | Major | 一覧の行が先に出て、確認の記録がまだないときに承認したらどうなるかが未定 |
| R-04 | Major | ページ分けの位置（cursor）の形と全件数が未定（Contract Design で Functional Design に回した点） |
| R-05〜R-07 | Minor | 写真のアップロード完了の確認、約束との細かな違い（device の値、スマホの時計）、管理者のアカウントと知らせの必須化 |

> 💡 教材ポイント: **adversarial** のレビューでは、人の承認ゲートに行く前に、AI（作り手）が自分で直して再レビューを受ける（最大 2 回）。advisory と違い、ここでは人に「直しますか？」と聞かない。

### 作り手の修正（人の判断を待たずに直す）
- R-01: 送信のキーを、証明の確認のすぐあと、ほかのどの確認よりも先に確かめる（BR2.6）
- R-02: 確認の記録（ReviewDecision）に、保存の知らせからハンターの ID を写して持つ（BR3.1・BR3.5）
- R-03: 確認の記録がまだないときは 404 `REVIEW_NOT_READY` と「少し待ってからもう一度」（BR3.7）
- R-04: cursor は前のページの最後の行（送信日時・reportId）を表す文字列、全件数も返す（BR4.4）
- R-05: アップロード完了のとき、保存場所の実物の存在・大きさ・形式を確かめる（BR2.9）
- R-06: U1 の捕獲日時はサーバーが受け付けた時刻（スマホの時計のずれを避ける）。`device` の値は約束に足す変更として扱う
- R-07: U1 では管理者のアカウントを作らないと明記。「保存した報告は必ず知らせを送る」を決まりに入れた

2 回目のレビューを実行。

2 回目の結果: **READY**。R-01〜R-07 はすべて解決。新しい指摘は Minor 1 件（R-08: 一覧の同順位の並べ方の書き方が 2 か所でずれている。BR4.4 に合わせればよい）。

U1 の Functional Design の作業は完了を記録（ステージの承認は、全 Unit がこのステージを終えたあと 1 回）。細い版なので、続けて U1 の次のステージに進む。

## 2. NFR Requirements（非機能の要件と技術の選択）— U1 `u1-skeleton`

担当エージェント: Architect Agent（inline）／ レビュー役: Architecture Reviewer Agent（adversarial、最大 2 回）

U1 の性能・セキュリティ・規模・信頼性・監視の要件を数値で決め、使う技術（tech-stack-decisions.md）を選ぶ。U1 で選んだ技術は U2〜U4 でも使う。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/nfr-requirements-questions.md`

| # | 質問 |
|---|---|
| Q1 | Lambda の実行環境（Node.js 22・Arm・メモリ） |
| Q2 | DynamoDB の表の分け方（部品ごと／1 つの表） |
| Q3 | ログインの仕組み（Cognito） |
| Q4 | API の入口の種類（HTTP API ／ REST API） |
| Q5 | 画面アプリの作り方と公開の方法（S3 ＋ CloudFront） |
| Q6 | 動作の監視（ログ・アラーム・X-Ray） |
| Q7 | 試験運用の間の「動いている割合」の目安 |

### 回答: すべて A → **Looks correct** → 成果物
- `performance-requirements.md` — 応答時間（一覧・詳細・承認 3 秒、送信 10 秒、p95）、画面の要件（文字・ボタンの大きさ、対応するブラウザ、ファイルの大きさ）
- `security-requirements.md` — Cognito、HTTP API の証明の確認、役割と持ち主の確認、HTTPS、暗号化、S3 を公開しない、ログに個人情報を出さない、秘密情報、脅威と手当て
- `scalability-requirements.md` — 規模、**費用の見込み表**（使う 8 つのサービスがすべて無料枠の中）、流量の制限（毎秒 10・瞬間 20）、メモリ、ログの保存期間、常時課金の禁止
- `reliability-requirements.md` — 99%／30 日の目安、送り直し、知らせの確実な配達（NFR Design へ）、バックアップを使わない理由
- `observability-requirements.md` — JSON のログ、見る指標、アラーム 2 つ（5xx の割合、Lambda のエラー）
- `tech-stack-decisions.md` — 技術の選択の表（Node.js 22 Arm、HTTP API、DynamoDB 部品ごと、Cognito、React ＋ MUI ＋ Vite、CDK、Vitest・Playwright など）と選ばなかったもの
- `traceability.json` — NFR1〜NFR14 と詳細の要件（NFR1.1 など）の対応。NFR14（操作の記録）は U4 の担当で N/A

> 💡 教材ポイント: 詳細の要件は、Inception の要件の ID に番号を足す（NFR4 → NFR4.1、NFR4.2 …）。こうすると、要件 → 詳細 → 設計 → コード → テストを ID でたどれる。

### レビュー（Architecture Reviewer Agent・adversarial）
結果: **READY**（Major 1・Minor 5）。adversarial でも Major が 2 件以下なら READY。レビュー記録は `construction/u1-skeleton/nfr-requirements/reviews/review-01.md`。
- Major: 画面は CloudFront の既定のドメイン（独自ドメインは Route 53 を使えないため不可）で公開するので、TLS 1.2 以上を CloudFront では設定・試験できない
- Minor: CORS・セキュリティのヘッダー、無効化の反映が最大 1 時間遅れることの明記、知らせの配達の失敗のアラーム、料金の数字の再確認、99% の目安が要件への追加であることの明記

指摘はステージの承認ゲート（全 Unit の完了後）で判断する。U1 の作業は完了を記録。

## 3. NFR Design（非機能の要件を満たす設計）— U1 `u1-skeleton`

担当エージェント: Architect Agent（inline）／ レビュー役: Architecture Reviewer Agent（adversarial、最大 2 回）

非機能の要件を満たす仕組みを決める。Domain Design・Contract Design から持ち越した「知らせを確実に届ける方法」（ADR-008）や「部品の身元の証明」（ADR-011）を、ここで決める。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-design/nfr-design-questions.md`

| # | 質問 |
|---|---|
| Q1 | 部品の間の知らせを確実に届ける方法（DynamoDB Streams → EventBridge → SQS ＋失敗の置き場） |
| Q2 | 部品の間のその場の呼び出しと部品の身元の証明（Lambda の直接の呼び出し ＋ IAM） |
| Q3 | ログインの出し直し用の値の保存場所（localStorage ＋ CSP） |
| Q4 | CloudFront の TLS（既定のドメインのため最低の版を決められない） |
| Q5 | CORS とセキュリティのヘッダー |
| Q6 | 知らせの配達の失敗に気づく方法（失敗の置き場のアラーム） |

### 回答（1 回目）
| # | 回答 |
|---|---|
| Q1 | B（保存のあと関数から直接 EventBridge に送る） |
| Q2 | A（関数から関数を直接呼び、IAM で相手を限る） |
| Q3 | A（localStorage ＋ CSP） |
| Q4 | A（CloudFront は HTTPS だけ、TLS の最低の版は既定に任せてリスクとして記録） |
| Q5 | A（CORS は 2 つの CloudFront だけ、セキュリティのヘッダーを付ける） |
| Q6 | B（配達の失敗のアラームは作らない） |

### AI の分析: 食い違い
- **Q1「直接送る」・Q6「アラームなし」⇔ 作業済みの U1 の設計 BR2.7・要件 NFR10.3（保存した報告は必ず知らせを送る）** → Q7

### 回答（2 回目）: Q7 = **B**
知らせは保存のあと直接送り、3 回送れなければ送信を失敗にして、同じ送信のキーの送り直しで必ず送る。BR2.7・NFR10.3 をこの意味に読み替えて記録する。

### 回答: **Looks correct** → 成果物
- `logical-components.md` — 論理的な構成要素 9 つ（画面の配信、Cognito、HTTP API、部品ごとの関数と表、写真の S3、EventBridge、直接の呼び出し、監視）と構成図、失敗したときの影響の範囲
- `security-design.md` — Cognito の設定、JWT オーソライザー、認可の共通の処理、IAM による部品の身元の証明、CSP などのヘッダーの値、CORS、受け入れたリスクの表
- `reliability-design.md` — 知らせの届け方のシーケンス図（eventSent の印、3 回のやり直し、送り直しで送る）、時間切れとやり直しの表、二重と同時の操作
- `performance-design.md` ／ `scalability-design.md` ／ `observability-design.md` — 一覧は 1 回のクエリ、関数の小ささ、流量の制限、メモリ、タグ、ログの項目、アラーム 2 つ
- `traceability.json` — NFR の詳細 40 件と設計の対応。検査は合格

> 💡 教材ポイント: 人が「簡単な方法（B）」を選んでも、それが前に決めた要件と食い違えば、AI は確認する。ここでは人が B を選び直し、要件の読み替えと残るリスク（送信をやめた報告は知らせが出ない）を記録として残した。決めるのは人、食い違いを見つけて記録するのは AI。

### レビュー（Architecture Reviewer Agent・adversarial）
1 回目の結果: **NOT-READY**（Major 3・Minor 2）。

| ID | 重大度 | 指摘 |
|---|---|---|
| R-01 | Major | 画面が Cognito を直接呼ぶ設計にしたため、約束（C1 の `/v1/session` の道と初回の手続きの印）とずれた。Cognito のリフレッシュトークンは「使うたびに 30 日延長」できない |
| R-02 | Major | 確実に届ける仕組みが報告の保存の知らせだけで、承認の知らせが失敗すると一覧が「確認中」のまま |
| R-03 | Major | 送信のキーの「作成中」に期限がなく、途中で止まると送り直しが 409 のまま |
| R-04 | Minor | 送信の時間の合計の見積もりが甘く、関数の時間切れの設定がない |
| R-05 | Minor | 署名付きの PUT の URL では、アップロードの大きさを制限できない |

### 作り手の修正
- R-01: 約束どおり `/v1/session` の道を作り、Accounts の関数が Cognito を呼ぶ。Cognito の **refresh token rotation**（出し直しのたびに新しい 30 日のトークン）で「最後の利用から 30 日」を満たす
- R-02: 承認にも同じ仕組み（eventSent の印、3 回のやり直し、同じ依頼元の送り直しで再送）を入れた。操作の記録の知らせは失敗してもログだけ（受け入れたリスク）
- R-03: 送信のキーの状態の表（なし／作成中〈30 秒の期限〉／保存済み・知らせまだ／済み）を作り、保存と写真の結び付けを DynamoDB のトランザクションで同時に行う
- R-04: 時間の予算を計算し直し（最悪 約 5.8 秒）、API の関数の時間切れを 8 秒、知らせの受け手を 10 秒に
- R-05: 署名付きの **POST**（ポリシーで 15 MB の上限を S3 が強制）に変更

2 回目のレビューを実行。
2 回目の結果: **READY**。R-01〜R-05 はすべて解決。新しい指摘: Major 1（署名付きの POST に変えたが、約束の `POST /v1/photos` の応答に POST 用の項目がなく、写真の S3 の CORS も POST を許していない）、Minor 1（2 つのタブで同時に出し直すと、トークンの更新でログアウトされることがある）。

> ⚠️ ハマりどころ: adversarial のレビューは「Major が 2 件以下」なら READY になるため、直した結果として新しい Major が 1 件出ても READY で終わる。READY の記録のあとに成果物を書き換えると記録が無効になるので、残った指摘はステージの承認ゲート（全 Unit の完了後）で人が判断する。

U1 の NFR Design の作業は完了を記録。

## 4. Infrastructure Design（AWS の構成の設計）— U1 `u1-skeleton`

担当エージェント: AWS Platform Agent（inline）／ レビュー役: Architecture Reviewer Agent（adversarial、最大 2 回）

AWS の具体の構成（CDK のスタック、リソースの設定）と、ビルド・試験・デプロイの流れ（CI/CD）を決める。

### AI が作った質問ファイル
`aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/infrastructure-design/infrastructure-design-questions.md`

| # | 質問 |
|---|---|
| Q1 | 写真のアップロードの方式（署名付きの POST ＋約束に項目を足す ／ PUT に戻す）— NFR Design の残りの Major |
| Q2 | CDK のスタックの分け方（4 つ ／ 1 つ） |
| Q3 | デプロイの前の確認（`cdk diff` と費用の見込みを示して人が承認） |
| Q4 | 2 つのタブから同時にトークンを出し直したときの扱い — NFR Design の残りの Minor |
| Q5 | アラームのメールの宛先の渡し方（リポジトリに書かない） |

### 回答: すべて A → **Looks correct** → 成果物
- `infrastructure-specification.md` — デプロイの方針の表、**CDK のスタック 4 つ**（Auth・Data・Api・Web。データは消さない設定）、サービスごとの設定（Cognito のトークンの更新と 60 秒の猶予、DynamoDB の表 7 つ、署名付きの POST、CloudFront、HTTP API、関数 7 つ、EventBridge）、U2〜U4 と共有するもの、**新しいリソースの費用の見込み（合計 月 数円以内）**、約束に足す項目
- `monitoring-design.md` — 指標、アラーム 2 つ（名前はタグの決まりに合わせる）、SLI／SLO、ログ
- `cicd-pipeline.md` — 流れの図、7 段階（手元の確認 → CI → 取り込み → **cdk diff と費用を示して人が承認** → デプロイ → スモーク → タグ）、戻し方、秘密情報の置き場所
- `traceability.json` — NFR の詳細 40 件。画面の決まり 3 件は AWS の構成に関係しないため N/A

> ⚠️ ハマりどころ: レビューを頼む前の自動の検査（upstream-coverage）で、「入力に挙がっている components と functional-spec を、成果物のどこからも参照していない」と止められた。成果物の冒頭の「入力:」に上流の文書の名前を書いておくと通る。

### レビュー（Architecture Reviewer Agent・adversarial）
1 回目の結果: **NOT-READY**（Critical 1・Major 2・Minor 4）。

| ID | 重大度 | 指摘 |
|---|---|---|
| R-01 | **Critical** | CDK のスタックの依存が輪になっている（写真の S3 と API の CORS は画面の URL が要り、画面の CSP とビルドは API の URL が要る）。`cdk synth` が失敗する |
| R-02 | Major | mononoke と共用のアカウントでの CDK の bootstrap（既存か、承認、費用、mononoke の bootstrap に触れない）が書かれていない |
| R-03 | Major | スモークが、写真のアップロード・報告の送信・知らせの配達を通らず、細い版の端から端を本物の AWS で確かめていない |
| R-04〜R-07 | Minor | タグの付け方、最初のデプロイの戻し方、SNS の購読の確認とアラームの式、NFR Design の CORS の記載のずれ |

### 作り手の修正
- R-01: スタックを 5 つに分け直し、依存を **Auth → Web → Data → Api → WebContent** の一方向にした。画面は API の URL をビルドに埋め込まず、起動のときに `config.json` を読む（実行時の設定）。CSP は地域の範囲（`*.execute-api.ap-northeast-1.amazonaws.com` など）で指定
- R-02: MonsterNote 専用の bootstrap（qualifier `mnote`、`MonsterNote-CDKToolkit`）を作り、mononoke の既定の bootstrap に触れない。作る前に人の承認（費用 0 円の見込み）
- R-03: スモークを細い版の 7 手順に広げた（ログイン → 写真の署名付きの POST → 報告 → 一覧に「確認中」→ 依頼元で承認 → 一覧に「承認」）
- R-04〜R-07: CDK の Aspect でリソースの種類ごとにタグ、最初のデプロイは前に進めて直す、SNS の確認のメール、アラームの計算式と treatMissingData、CORS の読み替えを明記

2 回目のレビューを実行。

> 💡 教材ポイント: **Critical**（そのままでは動かない）の指摘は、adversarial のレビューでなければ見落としやすい。設計の段階で「CDK のスタックの依存の輪」を見つけられたので、コードを書いてから `cdk synth` で失敗するより手戻りが小さい。
2 回目の結果: **READY**。R-01〜R-07 はすべて解決。新しい指摘は Minor 3 件（「4 つのスタック」の書き残し、Web を作り直すときの条件、BucketDeployment が作る関数の数と費用の記載）。

U1 の設計の 4 つのステージ（Functional Design・NFR Requirements・NFR Design・Infrastructure Design）が終わった。次は U1 の **Code Generation**。

## 5. Code Generation（コードの生成）— U1 `u1-skeleton`

担当エージェント: Developer Agent（subagent）／ レビュー役: Architecture Reviewer Agent（adversarial、最大 2 回）

コードを書く前に、AI が「何を・どの順で作るか」の計画と、テストの手順を書き、**人が計画を承認するまでコードは 1 行も書かれない**（Plan Approval）。

### 計画
`construction/u1-skeleton/code-generation/code-generation-plan.md` — 38 ステップ。テストを先に書く TDD の順（各層で Red → Green → Refactor）:
- リポジトリの土台（npm workspaces、TypeScript strict、ESLint・Prettier、Vitest、`.gitignore` に行を足す）
- API の共通の処理、Accounts、Reporting、Review、ReportCatalog（データの表と項目を、要件・設計の出典つきで列挙）
- 結合の試験（DynamoDB Local）、アカウントを作るスクリプト
- 画面（React ＋ MUI、UiKit・ハンター・依頼元）、E2E（Playwright、API はモック）
- CDK の 5 つのスタックと構成の試験、スモーク、GitHub Actions、約束の仕様のファイル、`npm run verify`

`unit-test-instructions.md` — U1 のテストだけを動かすコマンド（ファイル名の `.u1.test.` で絞る）、カバレッジ 80%、モックの置き換え表、試験の数の目安。

### Plan Approval: **Approve Plan**

> ⚠️ ハマりどころ: 計画が承認されるまで、AI-DLC のフックは書き換えのできるシェルのコマンドを止める（docs への追記さえ止められた）。また、開発者のエージェントに作業を渡すときは、`aidlc engine testing-posture brief --unit u1-skeleton` の出力（Unit の名前とテストの約束〈Testing Contract〉のハッシュ）を先頭に付けないと、渡すこと自体が止められる。

> 💡 教材ポイント: Testing Contract は、team.md のテストの決まり（TDD、Standard、80%）から AI-DLC が作る「テストの約束」で、ハッシュで固定される。計画とテストの手順とこの約束がそろって承認されたときだけ、コードを書ける。

### コードの生成
開発者のエージェント（subagent）が、承認された計画どおりに作っている（38 ステップ）。

### コードの生成の結果（1 回目）
- 38 ステップ中 37 ステップ完了。U1 のテスト 219 件が成功（API とスクリプト 136、画面 55、CDK の構成 28）、E2E は Chromium で 6/6 成功。行カバレッジ 96%（床は 80%）。format・lint・型・`cdk synth` は成功。AWS には何もしていない
- 残った問題:
  - 依存パッケージの脆弱性: `npm audit` で 55 件（実際に動くコードの分だけで critical 25）。古い版を固定したため
  - この PC で動かせないテスト: WebKit（iPhone の Safari 相当）の E2E は OS のライブラリが足りない、DynamoDB Local の結合の試験は Java がない（4 件スキップ）→ `npm run verify` が最後まで通らない
  - 計画との差: 報告の表に全身の写真の ID（`bodyPhotoId`）を持たせた（約束 C12 の知らせに含まれる項目）

### AI の質問: レビューの前にどうするか
### 回答: **先に依存を上げる**（開発者のエージェントがパッケージを現在の安定版に上げ、テストを通し直す）

> 💡 教材ポイント: AI のエージェントが「テストは通った」と報告しても、`npm audit` などで中身を確かめると問題が見つかることがある。AI-DLC では、こうした判断（直すか、受け入れるか）を人に聞いて記録してから先に進む。

### 依存の更新の結果
- `npm audit`: 55 件（critical 29）→ **0 件**。Vitest 5、Vite 7、AWS SDK・CDK・Playwright を最新の安定版に。React 18・MUI 6 は設計どおり据え置き
- U1 のテスト 219 件成功（4 件は Java がないためスキップ）、行カバレッジ 93%、Chromium の E2E 6/6、`cdk synth` 成功。WebKit の E2E はこの PC では動かない
- Vitest 5 で `--workspace` がなくなり、承認済みのテストの手順書のコマンドが動かなくなった。手元に Node.js 22.12 以上が必要に

### AI の質問: テストの手順書を直してよいか → 回答: **手順書を直す**
コマンドを `npx vitest run .u1.test.` に直し、Node.js 22.12 以上を書き足した。

> ⚠️ ハマりどころ: レビューを頼む前の確認で、変更したファイルの一覧（source-manifest.json）に `frontend/` のようなフォルダを書いていたため、「.gitignore で除外されたファイル（ビルドの出力）が入っている」と止められた。一覧はフォルダではなくファイルごとに書く。

### レビュー（Architecture Reviewer Agent・adversarial）
- 判定: **READY**（Critical・Major なし、Minor 3 件）
  - code-summary.md に古いコマンド（`--workspace`）が残っている
  - 承認した人の名前（decidedByName）がないとき、利用者の ID（UUID）がそのまま出る
  - WebKit の E2E と DynamoDB Local の結合の試験は、この PC ではまだ一度も動いていない（Build and Test で確かめる）

> 💡 教材ポイント: コードの生成が終わったあと、AI-DLC は「承認したテストの手順書が、ビルドの開始後に変わった」と知らせてくる。人の承認で直した場合でも、承認の時点の内容と今の内容が違うことを、AI-DLC はハッシュで見つけて必ず伝える。

## 6. スケルトンの確認（チェックポイント）

U1 の 5 つのステージ（Functional Design → NFR Requirements → NFR Design → Infrastructure Design → Code Generation）が終わると、AI-DLC は「スケルトンのチェックポイント」に進む。承認済みの確認のコマンド（`npm run verify`）を AI-DLC 自身が動かし、通った証拠をファイルの中身のハッシュと結び付けて残す。そのあとで人が承認する。

### AI の質問: この PC の準備をどうするか
- 調べた結果: シェルの Node.js が v20（Vitest 5 は 22.12 以上が必要）、WebKit の OS のライブラリが 9 個不足、Java がない（DynamoDB Local の結合の試験がスキップされる）
- 回答: **準備を整える**（nvm の既定を Node.js 24 にし、人が `sudo` で WebKit の依存と Java 17 を入れる）

### AI の質問: 承認したテストの手順書が、ビルドの開始後に変わった。元の計画で作り直すか
- 回答: **今の内容のまま**（人の承認で直したため）

> ⚠️ ハマりどころ: `nvm alias default 24` は新しいターミナルから効く。Claude Code は起動したときの Node.js（v20）を使い続けるので、Claude Code を終了して新しいターミナルで起動し直す必要がある。

### 確認の結果（npm run verify）
Node.js 24・Java 17・WebKit のライブラリがそろったあと、AI-DLC が `npm run verify` を実行し、**成功（終了コード 0）**。

| 中身 | 結果 |
|---|---|
| Prettier の書式の確認 | 成功 |
| ESLint | 成功 |
| TypeScript の型チェック（5 つの設定） | 成功 |
| Vitest（単体・結合・画面の部品・CDK の構成） | **223 件すべて成功**（飛ばし 0 件。DynamoDB Local の 4 件も実行） |
| 行カバレッジ | **93.00%**（床は 80%） |
| Playwright の E2E（AWS なし） | **12 件成功**（chromium 6 件・mobile-webkit 6 件） |
| `cdk synth` | 成功（5 つのスタック） |

結果はファイルの中身のハッシュと結び付けて `.aidlc-construction-checkpoints/u1-skeleton/skeleton.json` に残る。コードが 1 文字でも変わると、この証拠は無効になり、もう一度確かめ直しになる。

> ⚠️ ハマりどころ: `node_modules/.cache` がないと、DynamoDB Local の起動が `ENOENT` で落ちる（パッケージが途中のフォルダを作らないため）。空のフォルダを 1 つ作れば直る。

### 学んだことの記録（Learnings）
AI-DLC は承認の前に「人が直したことのうち、次回も通じるもの」を聞いてくる。
- 質問: 依存パッケージを古い版に固定せず、現在の安定版に上げて `npm audit` を 0 件に保つ。次回以降の決まりにするか
- 回答: **このプロジェクトの決まりにする** → `aidlc/spaces/default/memory/project.md` の `## Corrections` に 1 行追加された

> 💡 教材ポイント: 人が直した内容が、次に同じステージを動かすときの決まりとして自動で読まれるようになる。ステージの定義ファイル自体は書き換えず、プロジェクト・チームの決まりの側に足すのが AI-DLC のやり方。

### スケルトンの承認
- 質問: `npm run verify` で確かめた（終了コード 0）。この U1（スケルトン）を承認するか
- 回答: **Approve** → U1 の 5 ステージが完了として記録された

この版で作っていない受け入れ条件として、AI-DLC が **AC4.1.2**（一覧の絞り込み → U3）と **AC4.2.2**（重複の見比べ → U2）を挙げた。設計どおり、あとの Unit に回したもの。

> 💡 教材ポイント: AI-DLC は「この Unit で作らなかった受け入れ条件」を承認のときに必ず挙げる。人が「作ったつもり」で先に進むのを防ぐ仕組み。

## 7. PR と CI

チームの決まりどおり、作業ブランチ `feat/u1-skeleton` にコミットし、PR #1 を作って GitHub の画面で差分を確かめてから `main` に取り込む。

> ⚠️ ハマりどころ: `.github/workflows/ci.yml`（CI の設定）を含む push は、GitHub の認証に `workflow` の権限が要る。足りないと `refusing to allow an OAuth App to create or update workflow ... without 'workflow' scope` で止まる。`gh auth refresh -h github.com -s workflow` で足す。WSL ではブラウザが自動で開かないので、表示されたワンタイムコードを控えて https://github.com/login/device を手で開く。

### CI の 1 回目: 失敗
結合試験（DynamoDB Local）が `ENOENT: no such file or directory, mkdir '.../node_modules/.cache/dynamodb-local'` で落ちた。手元では「空のフォルダを 1 つ作る」でしのいでいたが、それは手元にしかない状態だった。

直し方: 結合試験の `beforeAll` で `mkdirSync(installPath, { recursive: true })` を実行する（`dynamodb-local` が途中のフォルダを作らないため）。キャッシュを消した状態で 4 件の成功と `npm run verify` の成功を確かめてから push。

> 💡 教材ポイント: 「自分の PC だけで通る状態」は、CI が必ず見つけてくれる。手元でその場しのぎをしたときは、必ずコードの側に直しを入れる。AI-DLC は承認後のコードの変更を覚えていて、次のチェックポイントで「レビュー後に変わった」と知らせてくる。
