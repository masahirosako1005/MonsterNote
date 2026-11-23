# Contract Summary（約束の一覧）— MonsterNote

入力: `inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-dependency.md`（unit-of-work-dependency。つなぎ目の表）、`inception/domain-design/components.md`（components）・`decisions.md`（ADR-007・ADR-008・ADR-009・ADR-011・ADR-012）、`inception/requirements-analysis/requirements.md`（requirements）、contract-design-questions.md（Q1〜Q6）。

約束（契約）は、境目をまたいで「どんなデータを、どんな形・方法で渡し、失敗したらどうするか」を決めたもの。仕様のファイルは、リポジトリの 1 か所（共通の約束の置き場）に置く（Q4。置き場所の名前は Code Generation で決める）。

## 1. 約束の一覧

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | Accounts（U1 で作り U4 で足す） | External: public web（HunterApp・RequesterApp・AdminApp） | REST（OpenAPI） | Accounts |
| C2 | Reporting（U1・U2・U4） | External: public web（HunterApp・RequesterApp・AdminApp） | REST（OpenAPI）＋期限付きのアップロード用 URL | Reporting |
| C3 | Review（U1・U3・U4） | External: public web（HunterApp・RequesterApp・AdminApp） | REST（OpenAPI） | Review |
| C4 | ReportCatalog（U1・U3・U4） | External: public web（HunterApp・RequesterApp・AdminApp） | REST（OpenAPI） | ReportCatalog |
| C5 | DuplicateDetection（U2・U4） | External: public web（RequesterApp・AdminApp） | REST（OpenAPI） | DuplicateDetection |
| C6 | Settings（U2・U4） | External: public web（AdminApp） | REST（OpenAPI） | Settings |
| C7 | AuditLog（U4） | External: public web（AdminApp） | REST（OpenAPI） | AuditLog |
| C8 | SpeciesDetection（U2） | Reporting（U2） | 部品の間のその場の呼び出し（内部の REST） | SpeciesDetection |
| C9 | DuplicateDetection（U2） | Reporting（U2） | 部品の間のその場の呼び出し（内部の REST） | DuplicateDetection |
| C10 | Accounts（U1） | Reporting（U1） | 部品の間のその場の呼び出し（内部の REST） | Accounts |
| C11 | Settings（U2） | Reporting・DuplicateDetection（U2） | 部品の間のその場の呼び出し（内部の REST） | Settings |
| C12 | Reporting（U1・U2） | Review（U1）、ReportCatalog（U1）、DuplicateDetection（U2） | 知らせ（AsyncAPI）: `report.saved` | Reporting |
| C13 | Review（U1・U3） | ReportCatalog（U1・U3）、DuplicateDetection（U2） | 知らせ（AsyncAPI）: `review.status-changed` | Review |
| C14 | DuplicateDetection（U2） | ReportCatalog（U3） | 知らせ（AsyncAPI）: `duplicate.suspected` | DuplicateDetection |
| C15 | すべての部品（U1〜U4） | AuditLog（U4） | 知らせ（AsyncAPI）: `audit.recorded` | AuditLog（形の持ち主） |
| C16 | 共通 | すべての約束 | 共通の形（ログインの証明、部品の身元の証明、エラー、知らせの外側と受け方） | Accounts（証明）・共通の約束の置き場 |
| C17 | SpeciesDetection（U4） | External: public web（AdminApp） | REST（OpenAPI）: 管理者による判別の結果の全削除 | SpeciesDetection |

C12〜C15 の知らせの届け方（使う AWS のサービス、再送、失われたときの扱い）は NFR Design で決める（ADR-008）。ここでは中身の形だけを決める。

## 2. 共通の約束（C16）

### 2.1 ログインの証明（ADR-007・ADR-011）

- 画面は、Accounts が発行したログインの証明を、`POST /v1/session`（ログイン）と `POST /v1/session/refresh`（証明の出し直し）を除くすべての API に `Authorization: Bearer <証明>` で付ける（レビューの R-08）。
- 証明には、利用者の ID（`sub`）、役割（`role`: `hunter` | `requester` | `admin`）、所属（`organization`: 依頼元だけ）が入る。有効期限は 1 時間。
- **証明の出し直し（30 日の保持。FR1.6、レビューの R-03）**: ログインのとき、証明と一緒に「出し直し用の値」を返す。出し直し用の値の有効期限は、最後に使ってから 30 日（使うたびに 30 日に延びる）。画面は証明が切れる前に `POST /v1/session/refresh` に出し直し用の値を送り、新しい証明を受け取る。無効にしたアカウント・30 日使わなかった値・ログアウトした値では 401 を返し、出し直さない（FR10.4 はここで効く）。出し直し用の値を画面のどこに保存するかは NFR Design で決める。
- 部品の間のその場の呼び出し（C8〜C11）で、画面からの操作の続きとして呼ぶときは、画面から受け取った証明をそのまま付ける。
- 証明がない・期限切れ・壊れている → 401。役割が足りない → 403。`/v1/admin/...` のすべての道は、管理者以外に 403、証明がないと 401 を返す（各道の応答の一覧で省略していても同じ。レビューの R-08）。

### 2.1b 部品の身元の証明（利用者がいない内部の呼び出し。レビューの R-01）

利用者の操作の続きではなく、部品が自分で動く処理（定期の処理、知らせで動く処理）は、利用者の証明を持たない。この場合は「部品の身元の証明」（その部品であることを示す、外からは手に入らない証明）を付けて呼ぶ。具体の仕組みは NFR Design・Infrastructure Design で決める。

部品の身元の証明で許す呼び出しは、次の表のものだけとする。表にない内部の道は、利用者の証明でしか呼べない。

| 呼ぶ部品 | 処理 | 呼ぶ道 | 許す理由 |
|---|---|---|---|
| Reporting | 24 時間たっても報告に結び付かない写真を消す（定期の処理。ADR-009） | C8 `DELETE /internal/v1/species-detections/by-photos` | 送ったハンターはもういない |
| DuplicateDetection | `report.saved` を受けて保存後に再判定する（ADR-003） | C11 `GET /internal/v1/settings` | 知らせで動き、利用者の証明がない |

知らせで動くほかの処理（Review が確認中の記録を作る、ReportCatalog が一覧の行を作る、AuditLog が記録する）は、ほかの部品を呼ばない。

### 2.2 エラーの形（Q6）

```yaml
# shared-schema: エラーの共通の形（すべての REST の約束で使う）
Error:
  type: object
  required: [code, message]
  properties:
    code:
      type: string
      description: 機械が読むエラーの種類（例 VALIDATION_FAILED, ALREADY_DECIDED）
    message:
      type: string
      description: 利用者に見せてよい日本語の説明
    details:
      type: array
      items:
        type: object
        properties:
          field: { type: string, description: 誤りのある項目 }
          reason: { type: string }
    conflict:
      type: object
      description: >
        409 のときの詳細（レビューの R-04）。DUPLICATE_SUSPECTED では matches（相手の種類・日時・おおよその距離の一覧。氏名と写真は入れない）、
        ALREADY_DECIDED では decision（approved・rejected）・decidedByName・decidedAt、SUBMISSION_IN_PROGRESS では retryAfterSeconds を入れる
```

| HTTP の状態番号 | 使うとき | code の例 |
|---|---|---|
| 400 | 入力の形が誤り（必須の項目がない、型が違う） | `VALIDATION_FAILED` |
| 401 | ログインの証明がない・期限切れ | `UNAUTHENTICATED` |
| 403 | 役割・持ち主が違う（ハンターが承認する、他人の報告を読む） | `FORBIDDEN` |
| 404 | ない | `NOT_FOUND` |
| 409 | すでに確認済み・取り消しの期限切れ・重複の疑い・同じ送信の処理中 | `ALREADY_DECIDED`、`UNDO_EXPIRED`、`DUPLICATE_SUSPECTED`、`SUBMISSION_IN_PROGRESS` |
| 422 | 業務の決まりに合わない（7 日より前、対象地域の外、同意していない） | `CAPTURED_AT_TOO_OLD`、`OUTSIDE_TARGET_AREA`、`CONSENT_REQUIRED` |
| 429 | API の流量の制限を超えた（project.md の API スロットリング） | `RATE_LIMITED` |
| 500 | サーバーの誤り | `INTERNAL_ERROR` |

### 2.3 時間切れとやり直し（Q6）

| 呼び出し | 時間切れ | やり直し |
|---|---|---|
| 画面 → API | 10 秒 | 報告の送信（C2 `POST /v1/reports`）は `submissionKey` で何度送っても 1 件になるため、画面はやり直してよい。同じ `submissionKey` の送信がまだ処理中のときは 409 `SUBMISSION_IN_PROGRESS`（`retryAfterSeconds: 2`）を返し、画面は 2 秒待って送り直すと、終わっていれば 200 で同じ reportId を受け取る（レビューの R-07）。それ以外の書き込みは自動でやり直さず、「もう一度」ボタンで人がやり直す |
| 部品の間のその場の呼び出し（C8〜C11） | 2 秒（1 回の呼び出しごと） | 呼ぶ側はやり直さない。報告の送信では C10（同意）→ C11（設定）→ C9（重複）の順に呼び、合計は最大 6 秒で、画面の 10 秒に収まる（レビューの R-07）。C8（判別）が時間切れなら「判別できなかった」として続ける（写真の受け付けの中で呼ぶため、送信の合計には入らない）。C9・C10・C11 が時間切れなら、送信を 500 で失敗させ、画面の「もう一度」に任せる |
| 知らせ（C12〜C15） | — | NFR Design で決める。受け手は `eventId` で 2 回目を無視する（Q3） |
| 知らせで動く処理の中の呼び出し（DuplicateDetection の保存後の再判定 → C11） | 2 秒 | 時間切れ・失敗のときは、処理を「失敗」として終え、知らせの再送に任せる（知らせを「処理済み」にしない）。直前に読んだ設定や既定値で代わりに判定することはしない（基準が変わった直後に、古い基準で疑いを付けたり外したりしないため）。再送の回数と、それでも失敗したときの扱いは NFR Design で決める（ADR-008。レビューの R-09） |

### 2.4 知らせの共通の外側（Q3）

```yaml
# shared-schema: すべての知らせの外側
EventEnvelope:
  type: object
  required: [eventId, type, version, occurredAt, source, data]
  properties:
    eventId: { type: string, format: uuid, description: 受け手はこれで 2 回目を無視する }
    type: { type: string, example: report.saved }
    version: { type: integer, minimum: 1, description: 中身の形を消す・意味を変えるときに上げる }
    occurredAt: { type: string, format: date-time }
    actorAccountId: { type: string, description: 操作した利用者（ADR-011）。部品が自動で起こしたときは空 }
    source: { type: string, enum: [Accounts, Reporting, SpeciesDetection, DuplicateDetection, Review, ReportCatalog, Settings], description: 知らせを送った部品。画面アプリは知らせを送らない（管理者の操作の記録は、API を提供する部品が audit.recorded を送る。レビューの R-10） }
    data: { type: object, description: 知らせの種類ごとの中身 }
```

受け手は、MonsterNote の部品が送った知らせだけを受け付ける（ADR-011。具体の方法は NFR Design・Infrastructure Design）。

### 2.5 知らせの順番が入れ替わったとき（レビューの R-05）

知らせは送った順に届くとは限らない。受け手は次の決まりで処理する。

- **新しいものだけを反映する**: 受け手は、報告ごとに最後に反映した知らせの `occurredAt`（同じ時刻なら `eventId` の大小）を覚え、それより古い知らせは反映しない。
- **`review.status-changed` が `report.saved` より先に届いたとき**: ReportCatalog と DuplicateDetection は、状態だけを先に覚えておき、`report.saved` が届いたら合わせて 1 行（1 つの索引）にする。
- **却下と却下の取り消しが逆の順で届いたとき**: DuplicateDetection は `occurredAt` の新しい方を正とし、索引の `active`（比べる相手にするか）を決める。古い「却下」があとから届いても、取り消しのあとなら反映しない。

## 3. 画面アプリが呼ぶ API（C1〜C7）

### C1 Accounts

```yaml
openapi: 3.0.3
info: { title: MonsterNote Accounts API, version: v1 }
paths:
  /v1/session:
    post:
      summary: ログイン（ID とパスワード。Bearer は付けない）。ログインの証明と出し直し用の値を返す（US1.1）
      responses: { '200': { description: 証明（1 時間）、出し直し用の値（最後の利用から 30 日）、初回の手続きが要るか（mustChangePassword, consentRequired, hunterNumberRequired） }, '401': { description: ID かパスワードが違う・無効のアカウント } }
    delete:
      summary: ログアウト。出し直し用の値も使えなくする（US1.1）
      responses: { '204': { description: ログアウトした }, '401': { description: 証明がない } }
  /v1/session/refresh:
    post:
      summary: 証明の出し直し（Bearer は付けず、出し直し用の値を送る。FR1.6・FR10.4、レビューの R-03）
      responses: { '200': { description: 新しい証明（1 時間）。出し直し用の値の期限は 30 日に延びる }, '401': { description: 30 日使っていない・ログアウトした・無効のアカウント } }
  /v1/me:
    get:
      summary: 自分のアカウント（役割・所属・表示名・初回の手続きの状態）
      responses: { '200': { description: 自分のアカウント } }
  /v1/me/password:
    put:
      summary: パスワードの変更（8 文字以上・英字と数字。US1.2）
      responses: { '204': { description: 変えた }, '422': { description: 規則に合わない } }
  /v1/me/consent:
    put:
      summary: 同意する（ハンター。US1.3）
      responses: { '204': { description: 同意した }, '403': { description: ハンターではない } }
  /v1/me/hunter-number:
    put:
      summary: 従事者番号の登録（ハンター。US1.4）
      responses: { '204': { description: 登録した }, '400': { description: 空 } }
  /v1/admin/accounts:
    get:
      summary: アカウントの一覧（管理者。US6.1）
      responses: { '200': { description: 一覧 }, '403': { description: 管理者ではない } }
    post:
      summary: アカウントの作成。仮のパスワードを 1 回だけ返す（管理者。US6.1）
      responses: { '201': { description: 作成と仮のパスワード }, '409': { description: ID が使われている }, '422': { description: 依頼元の所属がない } }
  /v1/admin/accounts/{accountId}/password-reset:
    post:
      summary: パスワードの再設定（管理者。US6.2）
      responses: { '200': { description: 新しい仮のパスワード } }
  /v1/admin/accounts/{accountId}/status:
    put:
      summary: 無効化・有効化（管理者。US6.3）
      responses: { '204': { description: 変えた } }
```

### C2 Reporting

```yaml
openapi: 3.0.3
info: { title: MonsterNote Reporting API, version: v1 }
paths:
  /v1/photos:
    post:
      summary: 写真のアップロードの準備。写真の ID と期限付きのアップロード用 URL を返す（ハンター。ADR-009、Q2）
      requestBody: { description: kind（body・tail・chest）、ファイルの種類、大きさ（15 MB まで）、撮影日時・位置（端末で読めたもの） }
      responses: { '201': { description: photoId と uploadUrl（期限 5 分） }, '422': { description: 形式・大きさが合わない } }
  /v1/photos/{photoId}/complete:
    post:
      summary: アップロードが終わったことを知らせる。全身の写真なら種類の判別の結果を返す（ハンター。US2.6）
      responses: { '200': { description: 判別の結果（outcome・species・confidence）。全身以外は結果なし }, '403': { description: 自分の写真ではない }, '404': { description: 写真がない・アップロードされていない } }
  /v1/reports:
    post:
      summary: 報告の送信（ハンター）。送信の前に重複の疑いを確かめる（US2.10・US3.2）
      requestBody: { description: submissionKey、写真の ID（body・tail・chest）、capturedAt と source（exif・manual）、location と source、species、sex、ageClass、captureMethod、chestPhotoMissing、confirmedNotDuplicate（重複の疑いを確かめたあと true） }
      responses:
        '201': { description: 保存した（reportId） }
        '200': { description: 同じ submissionKey ですでに保存済み（同じ reportId を返す） }
        '409': { description: 重複の疑いがある（DUPLICATE_SUSPECTED。Error.conflict.matches に種類・日時・おおよその距離を返す。氏名・写真は返さない）→ confirmedNotDuplicate を true にして送り直す。または同じ submissionKey の送信が処理中（SUBMISSION_IN_PROGRESS）→ 2 秒後に送り直す }
        '422': { description: 業務の決まりに合わない（7 日より前・未来・対象地域の外・同意していない・写真が自分のものでない） }
  /v1/reports/{reportId}:
    get:
      summary: 報告の詳細と写真の表示用 URL（期限付き）。ハンターは自分の報告だけ（US4.2・US5.2）
      responses: { '200': { description: 詳細 }, '403': { description: 自分の報告ではない } }
  /v1/report-settings:
    get:
      summary: 報告の作成に必要な設定（対象地域）（ハンター。ADR-010）
      responses: { '200': { description: 対象地域の中心と半径 } }
  /v1/admin/report-data:
    delete:
      summary: 報告と写真をすべて消す（管理者。US6.5）
      responses: { '200': { description: 消した件数 } }
```

### C3 Review

```yaml
openapi: 3.0.3
info: { title: MonsterNote Review API, version: v1 }
paths:
  /v1/reviews/{reportId}:
    get:
      summary: 報告の状態・却下の理由・確認した人。ハンターは自分の報告だけ（US5.2）
      responses: { '200': { description: 状態 }, '403': { description: 自分の報告ではない } }
  /v1/reviews/{reportId}/decision:
    put:
      summary: 承認・却下（依頼元。確認中のときだけ。US4.3・US4.4・US4.6）
      requestBody: { description: decision（approved・rejected）、reason（duplicate・insufficient-photo・out-of-scope・other）、reasonText（other のとき必須） }
      responses: { '200': { description: 確定（undoUntil を返す） }, '403': { description: 依頼元ではない }, '409': { description: すでに確認済み（ALREADY_DECIDED。確認した人と結果を返す） }, '422': { description: 理由がない・その他の文がない } }
  /v1/reviews/{reportId}/decision/undo:
    post:
      summary: 取り消し（操作した本人・10 秒以内。US4.5）
      responses: { '200': { description: 確認中に戻した }, '403': { description: 本人ではない }, '409': { description: 期限切れ（UNDO_EXPIRED） } }
  /v1/admin/review-data:
    delete:
      summary: 確認の記録をすべて消す（管理者。US6.5）
      responses: { '200': { description: 消した件数 } }
```

### C4 ReportCatalog

```yaml
openapi: 3.0.3
info: { title: MonsterNote ReportCatalog API, version: v1 }
paths:
  /v1/catalog/reports:
    get:
      summary: すべての報告の一覧（依頼元。新しい順・50 件。US4.1・US4.7）
      parameters:
        - { name: status, in: query, schema: { type: array, items: { type: string, enum: [checking, approved, rejected] } } }
        - { name: flag, in: query, schema: { type: array, items: { type: string, enum: [duplicate, manual] } } }
        - { name: cursor, in: query, schema: { type: string }, description: 次のページの位置 }
      responses: { '200': { description: 行（報告 ID・日付・ハンター名・種類・地名・状態・印・送ってから何日・7 日以上）と次のページの位置、全件数 }, '403': { description: 依頼元ではない } }
  /v1/catalog/my-reports:
    get:
      summary: 自分の報告の一覧（ハンター。新しい順・50 件。US5.1・US5.3）
      responses: { '200': { description: 行と次のページの位置 } }
  /v1/admin/catalog-data:
    delete:
      summary: 一覧をすべて消す（管理者。US6.5）
      responses: { '200': { description: 消した件数 } }
```

絞り込みは、同じ種類の条件どうしは「いずれか」（status=checking と status=approved なら、どちらか）、違う種類の条件どうしは「両方」（status=checking と flag=duplicate なら、両方を満たす）。

### C5 DuplicateDetection（画面向け）

```yaml
openapi: 3.0.3
info: { title: MonsterNote DuplicateDetection API, version: v1 }
paths:
  /v1/duplicates/{reportId}:
    get:
      summary: 報告の重複の疑いと、見比べる相手の報告 ID・距離・時間差（依頼元。US4.2）
      responses: { '200': { description: 疑いの一覧 }, '403': { description: 依頼元ではない } }
  /v1/admin/duplicate-data:
    delete:
      summary: 索引と疑いをすべて消す（管理者。US6.5）
      responses: { '200': { description: 消した件数 } }
```

### C6 Settings（画面向け）

```yaml
openapi: 3.0.3
info: { title: MonsterNote Settings API, version: v1 }
paths:
  /v1/admin/settings:
    get:
      summary: 重複の基準と対象地域（管理者。US6.4）
      responses: { '200': { description: 設定 } }
    put:
      summary: 変更（距離 1 m 以上、時間 1 時間以上、半径 0 より大。US6.4）
      responses: { '200': { description: 変えた }, '422': { description: 範囲外 } }
```

### C17 SpeciesDetection（画面向け。管理者の削除。レビューの R-02）

```yaml
openapi: 3.0.3
info: { title: MonsterNote SpeciesDetection admin API, version: v1 }
paths:
  /v1/admin/detection-data:
    delete:
      summary: 判別の結果をすべて消す（管理者。US6.5。ADR-006）
      responses: { '200': { description: 消した件数 }, '401': { description: 証明がない }, '403': { description: 管理者ではない } }
```

### C7 AuditLog

```yaml
openapi: 3.0.3
info: { title: MonsterNote AuditLog API, version: v1 }
paths:
  /v1/admin/audit-entries:
    get:
      summary: 操作の記録（管理者。新しい順・50 件。US6.6）
      parameters:
        - { name: cursor, in: query, schema: { type: string } }
      responses: { '200': { description: 記録（日時・誰が・操作・対象）と次のページの位置 }, '403': { description: 管理者ではない } }
```

## 4. 部品の間のその場の呼び出し（C8〜C11）

外からは呼べない内部の道（`/internal/...`）。画面の操作の続きでは、画面から受け取ったログインの証明をそのまま付ける（2.1）。利用者がいない処理では、2.1b の表にある呼び出しだけを部品の身元の証明で呼べる。画面アプリ（AdminApp を含む）は内部の道を呼ばない（管理者の削除は C17 などの `/v1/admin/...` を使う）。

```yaml
openapi: 3.0.3
info: { title: MonsterNote internal APIs, version: v1 }
paths:
  /internal/v1/species-detections:
    post:
      summary: C8 写真の種類の判別（Reporting → SpeciesDetection）
      requestBody: { description: photoId と写真の保存場所のキー }
      responses: { '200': { description: outcome（detected・undetected）、species、confidence、detectionId。サービスの失敗も undetected で 200 } }
  /internal/v1/species-detections/by-photos:
    delete:
      summary: C8 結び付かなかった写真の判別の結果を消す（Reporting の 24 時間の定期の処理 → SpeciesDetection。部品の身元の証明で呼ぶ。2.1b）
      responses: { '200': { description: 消した件数 } }
  /internal/v1/duplicate-checks:
    post:
      summary: C9 送信の前の重複の問い合わせ（Reporting → DuplicateDetection）
      requestBody: { description: species、capturedAt、location、photoHash（Should） }
      responses: { '200': { description: suspected（true・false）と相手（種類・日時・おおよその距離。氏名と写真は入れない） } }
  /internal/v1/hunters/{accountId}/report-eligibility:
    get:
      summary: C10 報告できるハンターか（同意・従事者番号・表示名）（Reporting → Accounts。ADR-012）
      responses: { '200': { description: eligible、hunterNumber、displayName } }
  /internal/v1/settings:
    get:
      summary: C11 重複の基準と対象地域を読む（Reporting は利用者の証明、DuplicateDetection の保存後の再判定は部品の身元の証明で呼ぶ。2.1b）
      responses: { '200': { description: 設定 } }
```

## 5. 知らせ（C12〜C15）

```yaml
asyncapi: 2.6.0
info: { title: MonsterNote events, version: v1 }
channels:
  report.saved:
    description: C12 報告が保存された（送り手 Reporting。受け手 Review・ReportCatalog・DuplicateDetection。ADR-012）
    subscribe:
      message:
        payload:
          type: object
          description: EventEnvelope の data
          required: [reportId, hunterAccountId, hunterName, species, capturedAt, location, manualEntry, submittedAt]
          properties:
            reportId: { type: string }
            hunterAccountId: { type: string }
            hunterName: { type: string }
            species: { type: string, enum: [bear, boar, deer] }
            capturedAt: { type: string, format: date-time }
            location: { type: object, properties: { lat: { type: number }, lng: { type: number } } }
            placeName: { type: string, description: 求められないときは空 }
            manualEntry: { type: boolean, description: 日時か場所を手で入れた }
            submittedAt: { type: string, format: date-time }
            bodyPhotoId: { type: string }
            photoHash: { type: string, description: Should（写真の重複）で使う }
  review.status-changed:
    description: C13 報告の状態が変わった（送り手 Review。受け手 ReportCatalog・DuplicateDetection。ADR-003）
    subscribe:
      message:
        payload:
          type: object
          required: [reportId, status, previousStatus, changedAt]
          properties:
            reportId: { type: string }
            status: { type: string, enum: [checking, approved, rejected] }
            previousStatus: { type: string, enum: [none, checking, approved, rejected] }
            reason: { type: string, enum: [duplicate, insufficient-photo, out-of-scope, other] }
            undone: { type: boolean, description: 取り消しで確認中に戻ったとき true }
            changedAt: { type: string, format: date-time }
  duplicate.suspected:
    description: >
      C14 重複の疑いが付いた（送り手 DuplicateDetection。受け手 ReportCatalog）。保存のあとの判定（report.saved を受けたとき）でだけ送る。
      送信の前の問い合わせ（C9）では、まだ reportId がないため送らない（ハンターが「別の個体なので送る」を選んだ報告も、保存のあとの判定で同じ疑いが見つかり、ここで送られる）。
      疑いの組（報告 A と B）ごとに 2 つ送る（reportId が A のものと B のもの）。レビューの R-06
    subscribe:
      message:
        payload:
          type: object
          required: [reportId, matchedReportId, kind]
          properties:
            reportId: { type: string, description: 印を付ける報告 }
            matchedReportId: { type: string, description: 疑いの相手の報告 }
            kind: { type: string, enum: [place-time, photo, moon-ring] }
  audit.recorded:
    description: C15 操作の記録（送り手 すべての部品。受け手 AuditLog。NFR14）
    subscribe:
      message:
        payload:
          type: object
          required: [action, targetType, targetId]
          properties:
            action: { type: string, example: report.submitted }
            targetType: { type: string, example: report }
            targetId: { type: string }
            detail: { type: object, description: パスワードと写真そのものは入れない }
```

却下と却下の取り消しは、別の知らせを作らず `review.status-changed` で伝える（`status: rejected` が却下、`previousStatus: rejected` かつ `undone: true` が却下の取り消し）。DuplicateDetection はこれで索引から外す・戻す（ADR-003）。

## 6. 約束の持ち主の決まり（Q4・Q5）

- 約束の持ち主は、提供する側（API は提供する部品、知らせは送る部品、C15 は受け手の AuditLog）。持ち主の Unit が仕様のファイルを変える。
- 仕様のファイルはリポジトリの 1 か所にまとめる。変えるときは PR で、提供側と利用側の両方の試験が通ることを確かめる（team-practices の PR と Squash and merge）。
- 項目を足すだけの変更は、いつでもしてよい。受け手は知らない項目を無視する。
- 項目を消す・意味を変える変更は、提供側と利用側を同じ PR で直す。知らせは `version` を上げる。
- API の道の版は `/v1` だけ。全体を一度にデプロイし、外の利用者は自分たちの 3 つの画面アプリだけのため、試験運用の間は `/v2` を作らない。
- U2 と U3 を同時に作るときは、この約束の仕様に合わせ、相手がまだないときは仕様どおりの試験用の代わり（知らせ・応答）で試す（unit-of-work-dependency）。

## 7. 未解決の点

| Contract | Question | Blocks |
|---|---|---|
| C12〜C15 | 知らせを確実に届ける方法、失われたときの扱い、知らせで動く処理が失敗したときの再送の回数と最後の扱い（ADR-008、2.3） | U1（知らせの仕組みの土台）、NFR Design |
| C16 | 知らせの送り手を確かめる具体の方法、内部の道（`/internal`）を外から呼べなくする方法、部品の身元の証明の仕組み（ADR-011、2.1b） | U1、NFR Design・Infrastructure Design |
| C1 | 出し直し用の値を画面のどこに保存するか（盗まれにくさと 30 日の保持の両立） | U1・U4、NFR Design |
| C2 | 期限付きのアップロード用 URL の期限（5 分）と、24 時間で結び付かない写真を消す仕組み（ADR-009） | U2、Functional Design |
| C2 | 地図のサービス（地名を求める）の選定（requirements OQ-3） | U2、Infrastructure Design |
| C4 | 50 件のページ分けの位置（cursor）の形と、全件数の数え方 | U1・U3、Functional Design |

## Assumptions & Open Questions

- 各 API の項目の型・制約の細部は Functional Design で決める。ここでは道、役割、主な項目、状態番号を決めた。 [assumption]
- 期限付きのアップロード用 URL の期限 5 分は、写真 1 枚のアップロードに十分な初期値。 [assumption]
