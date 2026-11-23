# Rules（業務の決まり）— U1 `u1-skeleton`

入力: entities.md、`inception/requirements-analysis/requirements.md`（requirements）、`inception/user-stories/stories.md`（stories）、`inception/domain-design/components.md`（components）・`decisions.md`、`inception/contract-design/contract-summary.md`（contract-summary）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、functional-design-questions.md（Q1〜Q6）。

```yaml
rules:
  # BR1 ログインと役割（Accounts、共通の処理）
  - id: BR1.1
    statement: ID とパスワードが正しく、アカウントが有効なときだけログインでき、証明（1 時間）と出し直し用の値（30 日）を返す
    category: authorization
    applies_to: Account
    trigger: POST /v1/session
    logic: IF ID が存在し AND パスワードが一致し AND status=active THEN 証明と出し直し用の値を返す ELSE 401「ID かパスワードが違います」（どちらが違うかは言わない）
    violation: 401 UNAUTHENTICATED
    source: [FR1.2, FR1.6, NFR4]
  - id: BR1.2
    statement: 役割ごとに使える API を分ける（ハンターは報告と自分の一覧・詳細、依頼元はすべての報告の一覧・詳細と承認）
    category: authorization
    applies_to: すべての API
    trigger: すべての API の呼び出し
    logic: IF 証明の role が、その API に許された役割でない THEN 拒否する
    violation: 403 FORBIDDEN
    source: [FR1.3, NFR4]
  - id: BR1.3
    statement: ログアウトしたら、出し直し用の値も使えなくし、画面はログイン画面に戻る
    category: policy
    applies_to: Account
    trigger: DELETE /v1/session
    logic: IF ログアウト THEN 出し直し用の値を無効にし、画面の証明を捨てる
    violation: —
    source: [FR1.7]
  - id: BR1.4
    statement: API を持つ各部品は、呼ばれるたびに証明が正しいか（改ざん・期限）を確かめる
    category: authorization
    applies_to: すべての API（POST /v1/session と /v1/session/refresh を除く）
    trigger: API の呼び出し
    logic: IF 証明がない OR 署名が正しくない OR 期限切れ THEN 拒否する
    violation: 401 UNAUTHENTICATED
    source: [NFR4]
  - id: BR1.5
    statement: 30 日以内に使った出し直し用の値で、新しい証明を出す。無効のアカウントには出さない
    category: policy
    applies_to: Account
    trigger: POST /v1/session/refresh
    logic: IF 出し直し用の値が有効 AND 最後の利用から 30 日以内 AND status=active THEN 新しい証明を返し、期限を 30 日に延ばす ELSE 401
    violation: 401 UNAUTHENTICATED
    source: [FR1.6, FR10.4]

  # BR2 写真と報告（Reporting）
  - id: BR2.1
    statement: 同意済みで従事者番号を持つハンターだけが報告できる
    category: authorization
    applies_to: Report
    trigger: POST /v1/reports
    logic: IF role=hunter AND consentedAt がある AND hunterNumber がある THEN 受け付ける ELSE 拒否する
    violation: 422 CONSENT_REQUIRED
    source: [FR1.4, FR1.5]
  - id: BR2.2
    statement: 写真は JPEG・PNG・HEIC で 15 MB まで。アップロード用 URL の期限は 5 分
    category: validation
    applies_to: Photo
    trigger: POST /v1/photos
    logic: IF contentType が許された形式 AND 1 ≤ sizeBytes ≤ 15 MB THEN 写真の ID と 5 分の URL を返す ELSE 拒否する
    violation: 422 VALIDATION_FAILED（理由は形式・大きさ）
    source: [FR2.12]
  - id: BR2.3
    statement: 報告に使える写真は、送るハンター自身がアップロードを終えたもので、まだどの報告にも結び付いていないものだけ
    category: authorization
    applies_to: Photo
    trigger: POST /v1/reports
    logic: IF photo.uploadedByAccountId = 送る人 AND uploadStatus=uploaded AND reportId が空 THEN 使える ELSE 拒否する
    violation: 422 VALIDATION_FAILED（写真が自分のものでない・アップロードが終わっていない）
    source: [FR2.2, NFR4]
  - id: BR2.4
    statement: U1 の報告には、全身の写真・種類・雌雄・捕獲日時・捕獲場所が必須（そのほかの項目は U1 では空を許す）
    category: validation
    applies_to: Report
    trigger: POST /v1/reports
    logic: IF 全身の写真 AND species ∈ {bear, boar, deer} AND sex ∈ {male, female, unknown} AND capturedAt AND location がある THEN 受け付ける ELSE 拒否する
    violation: 400 VALIDATION_FAILED（足りない項目を details に）
    source: [FR2.2, FR4.1]
  - id: BR2.5
    statement: U1 の捕獲日時は Reporting が報告を受け付けた時刻、捕獲場所は送信の時点のスマホの位置。位置の許可がないと送れない
    category: policy
    applies_to: Report
    trigger: 送信の画面と POST /v1/reports
    logic: IF 位置情報が取れた THEN location=位置、locationSource=device、capturedAt=サーバーが受け付けた時刻（スマホの時計がずれていても影響しない）、capturedAtSource=device ELSE 許可の手順を表示し、送信ボタンを押せなくする
    violation: 画面で送れない
    source: [FR2.3, FR2.4]
  - id: BR2.6
    statement: 同じ送信のキーの報告は 1 件だけ作る。処理中の同じキーには「処理中」を返す。送信のキーは、証明の確認のすぐあと、ほかのどの確認よりも先に確かめる
    category: constraint
    applies_to: Report
    trigger: POST /v1/reports
    logic: IF submissionKey の報告がすでにある（同じハンターのもの） THEN ほかの確認をせず 200 で同じ reportId を返す; IF 同じキーが処理中 THEN 409 SUBMISSION_IN_PROGRESS（2 秒後に送り直し）; ELSE BR2.1・BR2.3・BR2.4 を確かめて新しく作る
    violation: 409 SUBMISSION_IN_PROGRESS
    source: [FR2.8, FR2.10]
  - id: BR2.7
    statement: 報告を保存したら、写真に reportId を入れ、「報告が保存された」知らせ（ハンターの ID と表示名を含む）を必ず送る。保存した報告で知らせが送られないことがあってはならない（確実に届ける方法は NFR Design）
    category: policy
    applies_to: Report
    trigger: 報告の保存
    logic: IF 保存できた THEN 写真に reportId を入れ、report.saved（ハンターの表示名を含む）を送る
    violation: —
    source: [FR2.11]
  - id: BR2.8
    statement: ハンターは自分の報告の詳細だけを読める。依頼元はすべての報告の詳細を読める
    category: authorization
    applies_to: Report
    trigger: GET /v1/reports/{reportId}
    logic: IF role=requester OR (role=hunter AND hunterAccountId=自分) THEN 返す ELSE 拒否する
    violation: 403 FORBIDDEN
    source: [FR9.4, NFR4]

  - id: BR2.9
    statement: アップロードの完了の知らせを受けたら、保存場所に写真が実際にあり、大きさと形式が申告どおりで 15 MB 以下かを確かめてから「アップロード済み」にする
    category: validation
    applies_to: Photo
    trigger: POST /v1/photos/{photoId}/complete
    logic: IF 送った人が写真の持ち主 AND 保存場所に写真がある AND 実際の大きさ ≤ 15 MB AND 形式が申告どおり THEN uploadStatus=uploaded ELSE 写真を消して拒否する
    violation: 404 NOT_FOUND（写真がない）または 422 VALIDATION_FAILED（大きさ・形式が違う）
    source: [FR2.12]

  # BR3 確認（Review）
  - id: BR3.1
    statement: 「報告が保存された」知らせで、状態「確認中」の記録を作る（同じ知らせは 2 回目を無視する）
    category: policy
    applies_to: ReviewDecision
    trigger: report.saved を受けたとき
    logic: IF その報告の記録がない THEN status=checking、hunterAccountId=知らせのハンターの ID で作る; IF eventId が処理済み THEN 何もしない
    violation: —
    source: [FR8.4]
  - id: BR3.2
    statement: 承認は依頼元だけができる
    category: authorization
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision
    logic: IF role=requester THEN 受け付ける ELSE 拒否する
    violation: 403 FORBIDDEN
    source: [FR8.4, NFR4]
  - id: BR3.3
    statement: 状態が「確認中」のときだけ承認を受け付ける（先に受け付けた操作だけが有効）
    category: constraint
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision
    logic: IF status=checking THEN 書き換える（確認中であることを条件にした 1 回の書き換え） ELSE 409 で、確認した人と結果を返す
    violation: 409 ALREADY_DECIDED
    source: [FR8.6]
  - id: BR3.4
    statement: U1 の承認は確定で、取り消せない。確認した人と日時を記録し、「状態が変わった」知らせを送る
    category: policy
    applies_to: ReviewDecision
    trigger: 承認の受け付け
    logic: IF 承認した THEN status=approved、decidedBy・decidedAt を入れ、review.status-changed を送る
    violation: —
    source: [FR8.4, FR8.7]
  - id: BR3.5
    statement: ハンターは自分の報告の状態だけを読める
    category: authorization
    applies_to: ReviewDecision
    trigger: GET /v1/reviews/{reportId}
    logic: IF role=requester OR (role=hunter AND ReviewDecision.hunterAccountId=自分) THEN 返す ELSE 拒否する（Review は自分の記録のハンターの ID で判断し、Reporting を呼ばない）
    violation: 403 FORBIDDEN
    source: [FR9.4, NFR4]
  - id: BR3.7
    statement: 確認の記録がまだない報告（保存の知らせがまだ Review に届いていない）は、承認を受け付けず、少し待ってからもう一度押すよう返す
    category: constraint
    applies_to: ReviewDecision
    trigger: PUT /v1/reviews/{reportId}/decision、GET /v1/reviews/{reportId}
    logic: IF その報告の ReviewDecision がない THEN 拒否し、画面は「まだ確認の準備ができていません。少し待ってからもう一度押してください」を表示する
    violation: 404 REVIEW_NOT_READY
    source: [FR8.4]
  - id: BR3.6
    statement: 確認済みの報告の詳細では、承認のボタンを出さない
    category: policy
    applies_to: 依頼元の報告の詳細
    trigger: 詳細の表示
    logic: IF status≠checking THEN 承認のボタンを出さず、状態と確認した人を表示する
    violation: —
    source: [FR8.4]

  # BR4 一覧（ReportCatalog）
  - id: BR4.1
    statement: 一覧の行は知らせから作る。新しい知らせだけを反映し、状態が先に届いたら覚えておき、report.saved が届いてから一覧に出す
    category: policy
    applies_to: ReportListItem
    trigger: report.saved、review.status-changed を受けたとき
    logic: IF eventId が処理済み THEN 無視; IF report.saved THEN 内容を入れ savedReceived=true; IF review.status-changed AND occurredAt が lastStatusEventAt より新しい THEN status を書き換える
    violation: —
    source: [FR8.1, FR9.1]
  - id: BR4.2
    statement: 依頼元の一覧は、すべての報告を送信の新しい順に 1 ページ 50 件で返す。0 件なら「報告はまだありません」
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports
    logic: IF role=requester THEN savedReceived=true の行を submittedAt の新しい順（同じなら reportId）に 50 件と次のページの位置を返す
    violation: 403 FORBIDDEN（依頼元以外）
    source: [FR8.1, FR8.2]
  - id: BR4.3
    statement: ハンターの一覧は自分の報告だけを新しい順に返す。0 件なら「まだ報告はありません」
    category: authorization
    applies_to: ReportListItem
    trigger: GET /v1/catalog/my-reports
    logic: IF role=hunter THEN hunterAccountId=自分 の行だけを返す
    violation: 403 FORBIDDEN（ハンター以外）
    source: [FR9.1, FR9.4]

  - id: BR4.4
    statement: 一覧のページ分けは、次のページの位置（cursor）と全件数で行う
    category: calculation
    applies_to: ReportListItem
    trigger: GET /v1/catalog/reports、GET /v1/catalog/my-reports
    logic: 並び順は submittedAt の新しい順、同じなら reportId の大きい順。cursor は前のページの最後の行の（submittedAt、reportId）を表す、画面が中身を読まない文字列。次のページがなければ cursor は空。全件数は、その一覧の対象（依頼元はすべて、ハンターは自分の）で savedReceived=true の行の数。読み取った cursor が壊れていたら 400
    violation: 400 VALIDATION_FAILED（cursor が壊れている）
    source: [FR8.2]

  # BR5 アカウントを作るスクリプト（U1 の手順書）
  - id: BR5.1
    statement: スクリプトは、ハンターなら同意済みの日時と従事者番号を、依頼元なら所属を必ず入れてアカウントを作り、仮のパスワードをその場で 1 回だけ表示する
    category: validation
    applies_to: Account
    trigger: アカウントを作るスクリプトの実行
    logic: IF role=hunter AND hunterNumber がある THEN consentedAt=実行の時刻で作る; IF role=requester AND organization がある THEN 作る; IF role=admin THEN U1 では作らない（管理者の画面は U4）; ELSE エラーで止める
    violation: スクリプトがエラーで止まり、何も作らない
    source: [FR1.1, FR1.8]

  # BR6 写真の表示
  - id: BR6.1
    statement: 写真は、その報告を読める利用者にだけ、期限付きの表示用 URL で見せる
    category: authorization
    applies_to: Photo
    trigger: GET /v1/reports/{reportId}
    logic: IF BR2.8 で報告を読める THEN 15 分の表示用 URL を返す ELSE 返さない
    violation: 403 FORBIDDEN
    source: [NFR5]
```

## まとめ

| グループ | 決まり | 主な出典 |
|---|---|---|
| BR1 ログインと役割 | BR1.1〜BR1.5 | FR1.2・FR1.3・FR1.6・FR1.7・NFR4 |
| BR2 写真と報告 | BR2.1〜BR2.9 | FR2・FR4.1・FR9.4 |
| BR3 確認 | BR3.1〜BR3.7 | FR8.4・FR8.6・FR8.7 |
| BR4 一覧 | BR4.1〜BR4.4 | FR8.1・FR8.2・FR9.1 |
| BR5 アカウントのスクリプト | BR5.1 | FR1.1・FR1.8（U1 の手順書） |
| BR6 写真の表示 | BR6.1 | NFR5 |

## Assumptions & Open Questions

- 写真の表示用 URL の期限 15 分は初期値（一覧から詳細を見て判断する時間として）。 [assumption]
