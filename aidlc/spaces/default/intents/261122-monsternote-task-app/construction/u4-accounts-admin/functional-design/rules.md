# Rules（業務の決まり）— U4 `u4-accounts-admin`

入力: entities.md、`construction/u1-skeleton/functional-design/rules.md`（U1 の BR1〈ログイン〉・BR5〈アカウントのスクリプト〉）、`construction/u2-report-duplicate/functional-design/rules.md`（U2 の BR9〈設定〉）、`construction/u3-review-list/functional-design/rules.md`（U3 の BR3〈確認〉）、`inception/requirements-analysis/requirements.md`（requirements。FR1・FR10、NFR11・NFR14）、`inception/user-stories/stories.md`（stories）、`inception/domain-design/components.md`（components）・`decisions.md`（ADR-006）、`inception/contract-design/contract-summary.md`（contract-summary）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、functional-design-questions.md（Q1〜Q6）。

番号の付け方: U4 は **BR11（アカウントと初回の手続き）・BR12（操作の記録）・BR13（削除）**を新しく使う。U4 の受け入れ基準が直接指す U1 の決まり（ログイン、証明の出し直し）と U2 の決まり（設定の値の範囲）は、下に書き直して載せる。

```yaml
rules:
  # BR11 アカウントと初回の手続き（Accounts・AdminApp）
  - id: BR11.1
    statement: アカウントを作れるのは管理者だけ。管理者の画面には管理者しか入れない
    category: authorization
    applies_to: Account
    trigger: /v1/admin/... のすべて
    logic: IF role=admin THEN 受け付ける ELSE 拒む（ハンター・依頼元には管理者の画面も API も開かない。AC6.1.4）
    violation: 403 FORBIDDEN
    source: [FR1.1, FR1.3, FR10.1]
  - id: BR11.2
    statement: アカウントの作成には、役割・表示名・ID が必須。依頼元には所属も必須。ID は重ねられない
    category: validation
    applies_to: Account
    trigger: POST /v1/admin/accounts
    logic: >
      IF role ∈ {hunter, requester, admin} AND displayName が 1〜50 文字 AND loginId が英数字 3〜32 文字 THEN 続ける ELSE 拒む;
      IF role=requester AND organization がない THEN 拒む（AC6.1.2）;
      IF 同じ loginId のアカウントがある THEN 拒む（AC6.1.3。ID が重ならないことを条件にした 1 回の書き込みで作る）。
      **役割が admin のアカウントを作ったときは、有効な管理者の数（AdminCounter）を 1 増やす**（レビュー R-07。
      増やす決まりがどこにもないと、数が増えないまま減らす条件〈2 以上〉を満たせず、管理者を無効にできなくなる）。
      アカウントの書き込みと数の書き換えは、1 つのまとまった書き込みで行う（レビュー R-10）。
      作るときは、**認証のサービス側の `name` にも displayName を入れる**（U1 のスクリプトと同じ。レビュー R-04）。
      ログインの証明の `name` は、U3 の「確認した人」の表示がそこから名前を取るため、
      ここで入れ忘れると画面に名前が出ない
    violation: 422 VALIDATION_FAILED（項目が足りない・所属がない）／ 409 LOGIN_ID_TAKEN
    source: [FR1.1, FR1.3]
  - id: BR11.3
    statement: アカウントの作成とパスワードの再設定では、仮のパスワードを発行し、その場で 1 回だけ返す
    category: policy
    applies_to: Account
    trigger: POST /v1/admin/accounts、POST /v1/admin/accounts/{accountId}/password-reset
    logic: >
      仮のパスワード（8 文字以上・英字と数字を含む）を作り、mustChangePassword=true にして、応答に 1 回だけ入れる。
      保存も記録もしない（操作の記録にも入れない。AC6.6.3）。再設定のあとは古いパスワードでログインできない（AC6.2.1）。
      管理者がアプリの外で本人に渡す（FR1.8・FR10.3）。
      **「仮のパスワードかどうか」は MonsterNote 自身が `Account.mustChangePassword` で覚える**（レビュー R-01）。
      認証のサービス側では、仮のパスワードも「変更を求めない」状態で設定する（U1 のスクリプトと同じ形）。
      こうしないと、ログインが「新しいパスワードが必要」という別の応答になり、約束 C1 の `POST /v1/session`
      （証明と 3 つの印を返す）の形が崩れる。使えなくするのは認証のサービスではなく BR11.4 の決まり
    violation: —
    source: [FR1.8, FR10.3]
  - id: BR11.4
    statement: 仮のパスワードのままでは、パスワードの変更以外は何もできない
    category: constraint
    applies_to: Account
    trigger: ログインと、ログインのあとのすべての操作
    logic: >
      IF mustChangePassword=true THEN 画面はパスワードの変更だけを出し、ほかに進ませない（AC1.2.1）;
      サーバーは PUT /v1/me/password と GET /v1/me 以外を拒む。
      新しいパスワードは 8 文字以上で英字と数字を含むこと（AC1.2.2・AC1.2.3）。変更できたら mustChangePassword=false
    violation: 403 PASSWORD_CHANGE_REQUIRED ／ 422 VALIDATION_FAILED（規則に合わない）
    source: [FR1.8]
  - id: BR11.5
    statement: ハンターは同意するまで報告できない。「同意しない」を選んでも、次のログインでまた同意を求める
    category: constraint
    applies_to: Account
    trigger: PUT /v1/me/consent、ログイン後の画面の出し分け
    logic: >
      IF 「同意する」 THEN consentedAt=今の時刻（AC1.3.1）;
      IF 「同意しない」 THEN consentDeclinedAt=今の時刻 とし、報告を作れない旨と「管理者にご連絡ください」を表示する（AC1.3.2。Q4）;
      consentedAt がないあいだは、ログインのたびに同意の画面を出す（AC1.3.3）。
      報告の受け付けでも同意を確かめる（U1・U2 の「同意済みのハンターだけが報告できる」決まり）
    violation: 422 CONSENT_REQUIRED（報告のとき）
    source: [FR1.4, FR10.5]
  - id: BR11.6
    statement: ハンターは従事者番号を登録するまで先に進めない。空では登録できない
    category: validation
    applies_to: Account
    trigger: PUT /v1/me/hunter-number
    logic: >
      IF 数字 1〜20 桁 THEN hunterNumber に入れてホームへ進む（AC1.4.1）ELSE 拒み「番号を入れてください」（AC1.4.2）。
      登録した番号は、以後の報告に写される（AC1.4.3。U1・U2 の報告の決まり）
    violation: 400 VALIDATION_FAILED（空・形式が違う）
    source: [FR1.5]
  - id: BR11.7
    statement: 初回の手続きは、パスワードの変更 → 同意（ハンター）→ 従事者番号（ハンター）の順に求める
    category: policy
    applies_to: Account
    trigger: ログインの応答と GET /v1/me
    logic: >
      ログインの応答に mustChangePassword・consentRequired・hunterNumberRequired を入れ（C1）、
      画面はこの順に 1 つずつ出す。依頼元と管理者はパスワードの変更だけ。
      すべて済んだらホームへ進む
    violation: —
    source: [FR1.4, FR1.5, FR1.8]
  - id: BR11.8
    statement: ログインの状態は最後に使ってから 30 日保つ。無効にしたアカウントには証明を出し直さない
    category: policy
    applies_to: Account
    trigger: POST /v1/session/refresh
    logic: >
      IF 出し直し用の値が有効 AND lastActiveAt から 30 日以内 AND status=active THEN 新しい証明（1 時間）を返し、lastActiveAt を今にする
      （AC1.5.1）ELSE 401 でログイン画面へ（AC1.5.2・AC6.3.2）。
      報告の作成中に切れたときは「ログインが切れました。作成中の内容は消えました」を表示する（AC1.5.3）
    violation: 401 UNAUTHENTICATED
    source: [FR1.6, FR10.4]
  - id: BR11.9
    statement: 管理者は自分自身を無効にできない。有効な管理者が 1 人だけのとき、その管理者は無効にできない
    category: constraint
    applies_to: Account
    trigger: PUT /v1/admin/accounts/{accountId}/status
    logic: >
      IF 対象が自分 THEN 拒む（画面にもボタンを出さない。Q5）;
      管理者を無効にするときは、**有効な管理者の数を持つ 1 つの記録（AdminCounter）を「数が 2 以上である」ことを
      条件に 1 減らす書き換えと、アカウントの status を変える書き換えを、1 つのまとまった書き込み
      （どちらも成ってどちらも成らない形）で行う**（レビュー R-02・R-10）。片方だけが成ると、数と実際がずれる。
      数えてから書く形だと、2 人の管理者が同時に互いを無効にしたとき両方が通り、有効な管理者が 0 人になって
      誰も管理者の画面に入れなくなる。有効に戻すときは同じ記録を 1 増やす。
      管理者以外の無効化は、この記録に触れない（AC6.3.1・AC6.3.4）
    violation: 422 LAST_ADMIN（最後の管理者）／ 422 CANNOT_DISABLE_SELF（自分自身）
    source: [FR10.4]
  - id: BR11.10
    statement: 無効にしても、そのアカウントが送った報告と確認の記録は残る
    category: policy
    applies_to: Account
    trigger: 無効化
    logic: >
      status=disabled にするだけで、報告・写真・確認の記録・一覧には触れない（AC6.3.3）。
      一覧にはそのハンターの名前（送信のときの写し）が残り続ける
    violation: —
    source: [FR10.4]
  - id: BR11.11
    statement: 最初の管理者だけはスクリプトで作る。2 人目以降は管理者の画面で作る
    category: policy
    applies_to: Account
    trigger: アカウントを作るスクリプトの実行
    logic: >
      スクリプトの役割に admin を足す（U1 では作らない決まりだった。Q1）。
      管理者には同意も従事者番号も要らない。仮のパスワードはその場で 1 回だけ表示する。
      **管理者を作ったときは、有効な管理者の数（AdminCounter）を 1 増やす。記録がまだなければ 1 で作る**（レビュー R-07）。
      管理者が 1 人できたあとは、画面（BR11.2）で作る
    violation: スクリプトがエラーで止まり、何も作らない
    source: [FR1.1, FR1.8]

  # BR12 操作の記録（AuditLog）
  - id: BR12.1
    statement: 操作の記録を読めるのは管理者だけ。新しい順に 50 件ずつ返す
    category: authorization
    applies_to: AuditEntry
    trigger: GET /v1/admin/audit-entries
    logic: >
      IF role=admin THEN occurredAt の新しい順（同じなら entryId）に 50 件と次のページの位置を返す ELSE 拒む（AC6.6.3）
    violation: 403 FORBIDDEN
    source: [NFR14]
  - id: BR12.2
    statement: 操作の記録は知らせ（audit.recorded）から作る。同じ知らせを 2 回受けても 1 件しか作らない
    category: policy
    applies_to: AuditEntry
    trigger: audit.recorded を受けたとき
    logic: >
      IF その eventId の記録がすでにある THEN 何もしない ELSE 新しい記録を作る（eventId を条件にした 1 回の書き込み）。
      知らせの順番が入れ替わっても、並びは occurredAt で決まるため影響しない
    violation: —
    source: [NFR14]
  - id: BR12.3
    statement: 記録に残すのは、日時・操作した人・操作の種類・対象の ID・結果まで。中身は残さない
    category: policy
    applies_to: AuditEntry
    trigger: audit.recorded を受けたとき
    logic: >
      occurredAt・actorAccountId・actorName・action・targetType・targetId・outcome と、
      件数など ID 以外に必要な最小限の detail だけを入れる（Q6）。
      パスワード・写真そのもの・報告の中身（位置・氏名・種類）・却下の理由の文は入れない（AC6.6.3・C15）。
      利用者の ID は画面に出さず、actorName（無いときは役割の呼び名）を出す
    violation: —
    source: [NFR14]
  - id: BR12.4
    statement: 操作の記録は、あとから変えない・消さない。試験運用の終わりの削除でも消さない
    category: constraint
    applies_to: AuditEntry
    trigger: 記録の作成後のすべて
    logic: >
      書き換えと削除の入口を作らない（Q3）。
      「すべて削除」（BR13.1）の対象にも含めないため、「いつ誰が削除したか」が記録に残る。
      記録に残る個人情報は表示名（actorName）だけで、氏名・写真・報告の中身は入らない（BR12.3）。
      **試験運用そのものを終えるときは、AWS の環境ごと片付ける**（`cdk destroy`）ことで記録も消える（レビュー R-06）。
      記録だけを先に消す入口は作らない（「削除した」ことの記録を残すため）
    violation: —
    source: [NFR14, FR10.2]
  - id: BR12.5
    statement: 記録に残す操作は、報告の送信・承認・却下・取り消し・重複の疑い・アカウントの作成と再設定と無効化・設定の変更・データの削除
    category: policy
    applies_to: AuditEntry
    trigger: 各部品の操作
    logic: >
      各部品が audit.recorded を送る（C15）。U1〜U3 の部品はすでに送る形になっており、U4 で受け手ができて初めて記録される。
      ログインとログアウトは記録しない（回数が多く、NFR14 の目的〈問い合わせと不正の確認〉に要らないため）
    violation: —
    source: [NFR14]

  # BR13 試験運用の終わりの削除（各部品に足す入口）
  - id: BR13.1
    statement: 「すべて削除」は、部品ごとの入口を決まった順に呼ぶ。何度呼んでも同じ結果になる
    category: policy
    applies_to: 全部品のデータ
    trigger: 管理者の「すべて削除」
    logic: >
      順番は ① 一覧（ReportCatalog）② 確認の記録（Review）③ 重複の索引と疑い（DuplicateDetection）
      ④ 判別の結果（SpeciesDetection）⑤ 報告と写真（Reporting）。
      知らせを受け取る側から先に消し、報告と写真を最後にする（報告が残っていれば、途中で失敗してもやり直せる。Q2）。
      各入口は、もう何も無い状態で呼んでも 0 件を返して成功する。
      画面は、どの部品まで終わったかを出し、失敗したらその部品からやり直せるようにする。
      **5 つが終わったら、報告の件数と一覧の件数をもう一度数えて 0 件であることを確かめる**（レビュー R-05）。
      0 件でなければ「削除のあとに新しい報告が届きました。もう一度削除してください」と出し、やり直せるようにする
      （試験運用を止めてから行うのが前提だが、止め忘れても AC6.5.2 の「一覧は 0 件になる」に到達できるようにする）
    violation: —
    source: [FR10.2]
  - id: BR13.2
    statement: 削除の前に件数を出して確かめる
    category: policy
    applies_to: 全部品のデータ
    trigger: 管理者の「すべて削除」を押したとき
    logic: >
      報告の件数を数えて「報告 n 件と写真を削除します。よろしいですか？」と出す（AC6.5.1）。
      「削除する」で実行し（AC6.5.2）、「やめる」で何もしない（AC6.5.3）
    violation: —
    source: [FR10.2]
  - id: BR13.3
    statement: 削除できるのは管理者だけ。アカウントと操作の記録は消さない
    category: authorization
    applies_to: 全部品のデータ
    trigger: /v1/admin/*-data の削除
    logic: >
      IF role=admin THEN 受け付ける ELSE 拒む。
      アカウント（Account）は消さない（無効化で扱う。U1 の components の整理）。
      操作の記録（AuditEntry）も消さない（BR12.4。Q3）
    violation: 403 FORBIDDEN
    source: [FR10.2, NFR11]
  - id: BR13.4
    statement: 削除が終わったら、消した件数を操作の記録に残す
    category: policy
    applies_to: AuditEntry
    trigger: 各部品の削除の完了
    logic: >
      部品ごとに audit.recorded（action=data.deleted、targetType=data、detail に件数）を送る。
      どの部品をいつ誰が消したかが、あとから分かる（Q3）
    violation: —
    source: [FR10.2, NFR14]

  # U2 から引き継ぐ決まり（U4 の受け入れ基準が直接指すもの）
  - id: BR9.2
    statement: 設定の値には範囲がある。距離は 1 m 以上、時間は 1 時間以上、対象地域は北 > 南・東 > 西
    category: validation
    applies_to: Setting
    trigger: PUT /v1/admin/settings
    logic: >
      IF duplicateDistanceMeters ≥ 1 AND duplicateWindowHours ≥ 1
      AND targetAreaNorth > targetAreaSouth AND targetAreaEast > targetAreaWest THEN 受け付ける
      ELSE 拒み、「1 m 以上を入れてください」のように項目ごとの理由を出す（AC6.4.3）。
      画面でも同じ確認を行い、満たさないあいだは保存のボタンを押せなくする
    violation: 422 VALIDATION_FAILED（範囲外）
    source: [FR10.1, FR6.3, FR2.14]
  - id: BR9.4
    statement: 設定を変えたら、変えた人と日時を記録し、「設定が変わった」知らせを送る
    category: policy
    applies_to: Setting
    trigger: PUT /v1/admin/settings
    logic: >
      updatedByAccountId と updatedAt を入れ、audit.recorded（action=settings.updated）を送る。
      変えた基準は、変えたあとに送られる報告から使う（U2 の決まり。AC6.4.1）
    violation: —
    source: [FR6.3, FR10.1, NFR14]
```

## 決まりのまとめ

| 決まり | 内容 | 出典 |
|---|---|---|
| BR11.1〜BR11.3 | 管理者だけが入れる、作成の必須の項目、仮のパスワード | FR1.1・FR1.3・FR1.8・FR10.3 |
| BR11.4〜BR11.7 | 初回の手続き（パスワード・同意・従事者番号）とその順番 | FR1.4・FR1.5・FR1.8 |
| BR11.8 | 30 日のログインの保持と、無効にしたアカウントの締め出し | FR1.6・FR10.4 |
| BR11.9・BR11.10 | 自分自身と最後の管理者は無効にできない、無効にしても報告は残る | FR10.4 |
| BR11.11 | 最初の管理者はスクリプトで作る | FR1.1・FR1.8 |
| BR12.1〜BR12.5 | 操作の記録の読める人、作り方、残す範囲、消さないこと、対象の操作 | NFR14 |
| BR13.1〜BR13.4 | 「すべて削除」の順番とやり直し、件数の確認、消さないもの、記録 | FR10.2・NFR11 |
| BR9.2・BR9.4 | U2 から引き継ぐ（設定の値の範囲、変更の記録） | FR10.1・FR6.3 |

## Assumptions & Open Questions

- BR11.3 の仮のパスワードは、読み上げやすい文字（紛らわしい `0`・`O`・`1`・`l` を避ける）で 12 文字程度にする。紙に書いて手渡しするため（FR1.8）。 [assumption]
- BR11.9 の「有効な管理者が 1 人だけ」の判定は、有効な管理者の数を持つ記録（AdminCounter）を「2 以上である」ことを条件に 1 減らす書き換えで行う。数えてから書く形にはしない（レビュー R-02・R-07）。 [assumption]
- AdminCounter が実際のアカウントとずれないように、数を変えるのは 3 か所だけにする: 管理者を作ったとき（BR11.2・BR11.11）に 1 増やす、無効にしたとき（BR11.9）に 1 減らす、有効に戻したとき（BR11.9）に 1 増やす。管理者以外のアカウントでは触れない。 [assumption]
- 数とアカウントの書き換えは 1 つのまとまった書き込みで行うため、普通はずれない（レビュー R-10）。認証のサービス側の作成だけが別の書き込みになるため、そこで落ちるとアカウントが認証のサービスだけにできる。そのときは同じ ID でもう一度作ると 409 になるので、管理者が認証のサービス側を手で消してからやり直す。 [assumption]
- それでも万一ずれたときは、アカウントの一覧から数え直して記録を直せる。数え直しは**管理者の画面のアカウントの一覧を開いたとき**に行い、ずれていれば直す（定期の処理は作らない。レビュー R-10）。正本はアカウントの側で、この記録は管理者が 1 人もいなくなる事故を防ぐためだけに持つ。 [assumption]
- BR12.5 でログインとログアウトを記録しないのは、回数が多く NFR14 の目的に要らないため。必要になれば足せる。 [assumption]
- BR13.1 の順番は、知らせを受け取る側から先に消すことで、消したあとに遅れて届いた知らせで行が作り直されるのを減らす（完全には防げないため、削除は試験運用を止めてから行う）。 [assumption]
- 削除のあとに遅れて届いた知らせで、一覧の行や確認の記録が作り直されることがある。そのときは同じ順でもう一度削除する（BR13.1 の「何度呼んでも同じ結果」）。 [assumption]
