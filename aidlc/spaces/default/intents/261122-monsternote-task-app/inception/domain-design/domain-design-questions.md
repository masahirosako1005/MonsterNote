# Domain Design — 質問

前提: `inception/requirements-analysis/requirements.md`（FR1〜FR12、NFR1〜NFR14）、`inception/user-stories/stories.md`（US1.1〜US7.2）、`inception/practices-discovery/team-practices.md`（TDD、frontend / backend / infra）、`inception/refined-mockups/`（画面案）。

このステージでは、システムを「自分たちで書くプログラムの部品」（コンポーネント）に分け、各部品が持つデータ（エンティティ）と、部品どうしの呼び出し方を決めます。データベースや AWS の画像認識サービスなどは「部品が使う外部のもの」で、部品ではありません。どこに配置するか（サーバーの形）は次の Units Generation で決めます。

## 部品の分け方の案

| 部品 | 役割 | 持つデータ |
|---|---|---|
| Accounts（アカウント） | 利用者・役割・所属・同意・従事者番号、仮のパスワード、無効化 | Account |
| Reporting（報告） | 報告の作成、日時・場所の確認、写真の受け付け | Report、Photo |
| SpeciesDetection（種類の判別） | 写真から種類と確からしさを出す | DetectionResult |
| DuplicateDetection（重複の判定） | 距離・時間の基準で重複の疑いを見つける（送信前・保存後） | DuplicateSuspicion |
| Review（確認） | 承認・却下・取り消し・同時操作の決まり | ReviewDecision |
| Settings（設定） | 重複の基準、対象地域 | Setting |
| AuditLog（操作の記録） | 誰がいつ何をしたかの記録 | AuditEntry |
| WebApp（画面） | ハンター・依頼元・管理者の画面 | なし |

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 報告の「状態」（確認中・承認・却下）は、どの部品が持ちますか？

A. Review が承認・却下の記録（ReviewDecision）を持ち、報告の状態は Review が決める。Reporting は報告の内容だけを持つ（内容と確認の決まりが分かれ、同時操作・取り消しの決まりを Review に集められる）
B. Reporting が報告の状態も持ち、Review は Reporting に「状態を変えて」と頼むだけ
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 種類の判別と重複の判定は、報告の部品から分けますか？

A. 両方とも分ける（SpeciesDetection と DuplicateDetection）。判別のサービスの差し替えや、写真・月の輪の重複（Should）の追加を、報告の部品に影響させずに行える
B. 種類の判別だけ分け、重複の判定は Reporting の中に入れる
C. 両方とも Reporting の中に入れる（部品が少なく分かりやすい）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] 操作の記録（監査の記録）は、どう集めますか？

A. AuditLog という部品に集める。各部品は「〜が起きた」という知らせ（イベント）を送り、AuditLog が受け取って記録する（各部品は記録の形を知らなくてよい）
B. 各部品が、自分で AuditLog の部品を直接呼んで記録する
C. 各部品が自分の記録を自分で持つ（AuditLog の部品は作らない）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] 保存後の重複の再判定（ほぼ同時の 2 件、requirements FR6.4）は、どう動かしますか？

A. 送信のときは Reporting が DuplicateDetection をその場で呼んで結果を待つ（送信前の知らせのため）。保存のあとは「報告が保存された」という知らせで DuplicateDetection が非同期にもう一度判定する
B. 送信のときに 1 回だけその場で判定し、保存後の再判定は 1 日 1 回まとめて行う
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] 画面（WebApp）は、どう分けますか？

A. 1 つの Web アプリの中に、ハンター・依頼元・管理者の 3 つの区画を作る。ログインした人の役割で表示する区画を切り替え、共通の部品（ボタン・ダイアログ）を共有する
B. ハンター用・依頼元用・管理者用の 3 つの Web アプリに分ける
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q6. [アーキテクト] 試験運用の終わりのデータの削除（requirements FR10.2）は、どの部品が行いますか？

A. データを持つ各部品（Reporting・Review・DuplicateDetection など）が、自分のデータを消す機能を持つ。管理者の画面から各部品を順に呼ぶ（データを持つ部品だけが、そのデータを消す）
B. 削除専用の部品（DataLifecycle）を作り、すべてのデータを直接消す
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 部品: Accounts、Reporting、SpeciesDetection、DuplicateDetection、Review、Settings、AuditLog と、画面の部品（Q5 により 3 つ）
- 報告の状態: Review が承認・却下の記録（ReviewDecision）を持ち、状態を決める。Reporting は報告の内容だけを持つ [Q1]
- 判別と重複: SpeciesDetection と DuplicateDetection を、Reporting から分ける [Q2]
- 操作の記録: 各部品が「〜が起きた」という知らせ（イベント）を送り、AuditLog が受け取って記録する [Q3]
- 重複の判定: 送信のときは Reporting が DuplicateDetection をその場で呼んで結果を待つ。保存のあとは「報告が保存された」という知らせで、DuplicateDetection が非同期にもう一度判定する [Q4]
- 画面: ハンター用（HunterApp）・依頼元用（RequesterApp）・管理者用（AdminApp）の 3 つの Web アプリに分ける。ボタン・ダイアログ・テーマなどの共通の画面部品は、3 つが共有する部品集（UiKit）にまとめる（team-practices の `frontend` の中に置く） [Q5]
- データの削除: データを持つ各部品が自分のデータを消す機能を持ち、管理者の画面から順に呼ぶ [Q6]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
