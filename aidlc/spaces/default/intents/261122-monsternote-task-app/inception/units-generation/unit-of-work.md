# Unit of Work（作る単位）— MonsterNote

入力: `inception/domain-design/components.md`（components。部品 12 個）・`decisions.md`（decisions。ADR-001〜ADR-012）、`inception/requirements-analysis/requirements.md`（requirements）、`inception/user-stories/stories.md`（stories）、`inception/practices-discovery/team-practices.md`（team-practices）、units-generation-questions.md（Q1〜Q5、計画の承認）。

## 1. 方針

| 項目 | 決定 | 出典 |
|---|---|---|
| 切り方 | 機能ごとの縦切り。1 つの Unit に、その機能の API（裏側）と画面をまとめる | Q1 |
| 数 | 大きめの 4 個 | Q2 |
| 配置 | 全体を 1 つの AWS の構成（1 つの CDK アプリ）として dev に配置する。裏側は機能ごとの小さな関数（Lambda）、API の入口は 1 つ。3 つの画面も同じ構成で配置する。デプロイは Unit ごとではなく、その時点の全体をまとめて行う（Unit は作る単位で、配置の単位ではない） | Q3 |
| 1 つ目の Unit | 最初の細い版（ログイン → 写真 1 枚の報告 → 依頼元が承認）と AWS の土台 | Q4、team-practices |
| 同時に進めること | 依存のない Unit は同時に進めてよい | Q5 |

部品（components）は複数の Unit にまたがる。1 つ目の Unit が部品の最小の形を作り、後の Unit がその部品に機能を足す（下の「部品と Unit の対応」）。

## 2. Unit の一覧

| Unit ID | Directory | 名前 | 種類（kind） | 配置 | 大きさ |
|---|---|---|---|---|---|
| U1 | `u1-skeleton` | 最初の細い版と AWS の土台 | service | 共通の構成に含める（土台を作る） | L |
| U2 | `u2-report-duplicate` | 報告の作成と重複の疑い | service | 共通の構成に含める | XL |
| U3 | `u3-review-list` | 確認の操作と一覧 | service | 共通の構成に含める | M |
| U4 | `u4-accounts-admin` | アカウントの手続きと管理者の画面 | service | 共通の構成に含める | L |

種類はすべて `service`（裏側の関数と画面を合わせて配置する機能のまとまり）。画面だけ・仕様だけの Unit はない。

## 3. Unit の内容

### U1 `u1-skeleton` — 最初の細い版と AWS の土台

- **説明**: 端から端まで一通り動く最小の版。ハンターが全身の写真 1 枚と手で選んだ種類・雌雄で報告を送り、依頼元が一覧で見て承認し、ハンターの一覧に「承認」と出るまでを、dev にデプロイして確かめる。
- **ストーリー**: US1.1、US2.1、US4.1、US4.2、US4.3、US5.1（stories の 🦴）
- **部品**: Accounts（ログイン・役割の証明。アカウントは管理者が手順書で作る）、Reporting（写真 1 枚の受け付けと報告の保存）、Review（確認中の記録と承認）、ReportCatalog（一覧。絞り込みなし）、UiKit（2 つのテーマと最小の部品）、HunterApp・RequesterApp（最小の画面）
- **AWS の土台**: 認証、写真の保存場所、データベース、API の入口、部品の間の知らせの仕組み、2 つの画面の公開、タグ・ログの保存期間・API の流量の制限（project.md）
- **境界**: 種類の判別、重複の判定、却下、日時・場所の確認は入れない。ログインの証明の確認（ADR-007）と知らせの受け付けの決まり（ADR-011）は、ここで共通の処理として作る。
- **同意と従事者番号（レビューの R-01）**: 同意と従事者番号を登録する画面は U4 で作る。U1 では、管理者が手順書でアカウントを作るときに、同意済み（同意の日時）と従事者番号の登録済みの状態をあわせて入れる。Reporting の「同意済みのハンターか確かめる」決まりは U1 から動かし、同意していないアカウントでは報告できないことも U1 で試す。報告の従事者番号には、手順書で登録した番号が入る。
- **確かめ方**: 手元で `npm run verify`、人の確認のあと dev にデプロイして `npm run smoke`（team-practices）

### U2 `u2-report-duplicate` — 報告の作成と重複の疑い

- **説明**: 細い版の報告を、完全な報告（7・8 ステップ）に置き換え、重複の疑いを見つける。
- **ストーリー**: US2.2〜US2.11、US3.1〜US3.3、US7.1・US7.2（Should）
- **部品**: Reporting（写真の先の受け付け、24 時間で消す仕組み、日時・場所の確認、交付金の項目、地名）、SpeciesDetection（全部）、DuplicateDetection（全部。索引、送信前と保存後の判定）、Settings（裏側。基準と対象地域の読み出し、初期値）、HunterApp（報告の作成の全画面）、UiKit（PhotoPicker・BigChoice・DateTimeQuick・MapPicker・ConfirmDialog）
- **境界**: 設定を変える画面は U4。Should（US7.1・US7.2）は Must の後に挑戦し、間に合わなければ次の版に回す（scope-document）。

### U3 `u3-review-list` — 確認の操作と一覧

- **説明**: 依頼元の却下・取り消し・同時の操作と、一覧の絞り込み・ページ分け、ハンターの報告の詳細を作る。
- **ストーリー**: US4.1（絞り込みの部分。AC4.1.2）、US4.4〜US4.7、US5.2・US5.3
- **部品**: Review（却下と理由、10 秒の取り消し、先着の決まり、却下・取り消しの知らせ）、ReportCatalog（絞り込み 5 種、50 件のページ分け、7 日以上の印、重複の疑いの印の受け取り）、RequesterApp（一覧・詳細・却下の画面、DecisionBar）、HunterApp（自分の報告の詳細、却下の理由）
- **境界**: 重複の疑いの印は、U2 の DuplicateDetection が送る知らせの形（Contract Design で決める）に合わせて受け取る。U2 がなくても、知らせの形どおりの試験用の知らせで試せる。

### U4 `u4-accounts-admin` — アカウントの手続きと管理者の画面

- **説明**: 初回の手続きと管理者の画面を作り、手順書で行っていたアカウントの操作を画面に置き換える。
- **ストーリー**: US1.2〜US1.5、US6.1〜US6.6
- **部品**: Accounts（仮のパスワード、初回の変更、同意、従事者番号、30 日の保持、無効化・有効化・再設定）、Settings（変更の操作）、AuditLog（全部）、AdminApp（全部）、各部品の削除の機能の呼び出し（Reporting・SpeciesDetection・DuplicateDetection・Review・ReportCatalog）
- **境界**: 削除の機能そのものは各部品の持ち主の Unit で作るのではなく、U4 で各部品に足す（データの持ち主の部品に、削除の入口を加える。ADR-006）。

## 4. 部品と Unit の対応

| 部品 | U1 | U2 | U3 | U4 |
|---|---|---|---|---|
| Accounts | ログイン・証明 | — | — | 初回の手続き・管理（削除の入口は持たない。アカウントは試験運用の終わりも無効化で扱う） |
| Reporting | 写真 1 枚・保存 | 完全な報告 | — | 削除の入口 |
| SpeciesDetection | — | 全部 | — | 削除の入口 |
| DuplicateDetection | — | 全部 | — | 削除の入口 |
| Review | 確認中・承認 | — | 却下・取り消し・先着 | 削除の入口 |
| ReportCatalog | 一覧（最小） | — | 絞り込み・ページ・印 | 削除の入口 |
| Settings | — | 裏側・初期値 | — | 変更の画面と操作 |
| AuditLog | — | — | — | 全部 |
| UiKit | テーマ・最小の部品 | 報告の部品 | DecisionBar など | 管理の画面の部品 |
| HunterApp | 最小の画面 | 報告の作成 | 自分の報告の詳細 | 初回の手続きの画面 |
| RequesterApp | 一覧・詳細・承認 | — | 絞り込み・却下・取り消し | — |
| AdminApp | — | — | — | 全部 |

AuditLog は U4 で作るため、U1〜U3 の部品は、知らせ（操作の記録用）を送るだけにしておく（受け手がまだなくても動く）。

## 5. 実装の注意

- すべての Unit で TDD（Red → Green → Refactor）、行カバレッジ 80% 以上（team-practices）。
- AWS へのデプロイ・削除は、毎回人に確認する。新しい AWS のリソースは、作る前に無料枠と月額の見込みを示す（project.md）。
- 部品の間の呼び出しと知らせの形は、次の Contract Design で決める。各 Unit はその形に合わせて作り、相手の Unit がまだないときは、形どおりの試験用の代わりで試す。

## Assumptions & Open Questions

- U2 は大きさ XL（15 ストーリー）。Delivery Planning で、1 か月に収まるかを確かめる（Should の US7.1・US7.2 を後回しにできる）。 [assumption]
- 各 Unit の大きさ（S/M/L/XL）は、ストーリーの数と部品の数からの目安。 [assumption]
