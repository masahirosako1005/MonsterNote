# Rules（業務の決まり）— U2 `u2-report-duplicate`

入力: entities.md、`construction/u1-skeleton/functional-design/rules.md`（U1 の決まり。BR1〜BR6 は U1 で定義済み）、`inception/requirements-analysis/requirements.md`（requirements。FR2・FR3・FR4・FR5・FR6・FR7）、`inception/user-stories/stories.md`（stories）、`inception/domain-design/components.md`（components）・`decisions.md`、`inception/contract-design/contract-summary.md`（contract-summary）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、functional-design-questions.md（Q1〜Q8）。

番号の付け方: U1 の rules.md は、ログイン・写真と報告・確認・一覧・アカウントのスクリプト・共通の決まりを定義している。U2 は **BR2 の続き（BR2.10 以降）**で報告の決まりを足し、**BR6（種類の判別）・BR7（送信の前の知らせ）・BR8（重複の判定）・BR9（設定）**を新しく使う。U2 の受け入れ基準が拠る U1 の決まりのうち、**U2 で内容が変わるもの、または U2 の基準が直接指すもの**は、下に書き直して載せる（写真の形式、送信のキー、保存の知らせ、アップロードの完了の確認）。U1 だけで使う決まりは U1 の rules.md のままとする。

```yaml
rules:
  # BR2 写真と報告（Reporting）— U1 から引き継ぐ決まり（U2 の受け入れ基準が直接指すもの）
  - id: BR2.2
    statement: 写真は端末で長辺 2,048 px の JPEG に縮小してから送る。選ぶ時点では JPEG・PNG・HEIC で 15 MB まで。アップロード用 URL の期限は 5 分
    category: validation
    applies_to: Photo
    trigger: 写真を選ぶとき（画面）と POST /v1/photos
    logic: >
      画面: IF 形式が JPEG・PNG・HEIC AND 1 ≤ 大きさ ≤ 15 MB THEN 撮影情報を読み取り、長辺 2,048 px の JPEG に縮小する
      ELSE 理由を出して選び直してもらう; IF JPEG に変えられない THEN 理由を出して選び直してもらう。
      サーバー: 縮小後の JPEG だけを受け付け、写真の ID と 5 分の URL を返す（U1 から変更。functional-spec の D-4）
    violation: 422 VALIDATION_FAILED（理由は形式・大きさ）
    source: [FR2.2, FR2.12]
  - id: BR2.6
    statement: 同じ送信のキーの報告は 1 件だけ作る。処理中の同じキーには「処理中」を返す
    category: constraint
    applies_to: Report
    trigger: POST /v1/reports
    logic: >
      IF submissionKey の報告がすでにある（同じハンターのもの） THEN ほかの確認をせず 200 で同じ reportId を返す;
      IF 同じキーが処理中 THEN 409 SUBMISSION_IN_PROGRESS（2 秒後に送り直し）;
      ELSE 以降の確認に進む。送信のキーは、証明の確認のすぐあと、ほかのどの確認よりも先に確かめる
    violation: 409 SUBMISSION_IN_PROGRESS
    source: [FR2.8, FR2.10]
  - id: BR2.7
    statement: 報告を保存したら、写真に reportId を入れ、「報告が保存された」知らせを必ず送る
    category: policy
    applies_to: Report
    trigger: 報告の保存
    logic: IF 保存できた THEN 写真に reportId を入れ、期限を外し、report.saved（ハンターの表示名を含む）を送る
    violation: —
    source: [FR2.11]
  - id: BR2.9
    statement: アップロードの完了の知らせを受けたら、保存場所に写真が実際にあり、大きさと形式が申告どおりかを確かめてから「アップロード済み」にする
    category: validation
    applies_to: Photo
    trigger: POST /v1/photos/{photoId}/complete
    logic: >
      IF 送った人が写真の持ち主 AND 保存場所に写真がある AND 実際の大きさ ≤ 15 MB AND 形式が申告どおり
      THEN uploadStatus=uploaded（全身なら判別に進む。BR6.2） ELSE 写真を消して拒む
    violation: 404 NOT_FOUND（写真がない）または 422 VALIDATION_FAILED（大きさ・形式が違う）
    source: [FR2.12]

  # BR2 写真と報告（Reporting）— U2 で足す決まり
  - id: BR2.10
    statement: 捕獲日時と捕獲場所は、全身の写真の撮影情報を使い、全身にない項目は尻尾の写真の撮影情報を使う
    category: calculation
    applies_to: Report
    trigger: 内容の確認の画面を開くとき（画面が決め、送信で送る）
    logic: >
      IF 全身の写真に撮影日時がある THEN capturedAt=全身の撮影日時、capturedAtSource=exif
      ELSE IF 尻尾の写真に撮影日時がある THEN capturedAt=尻尾の撮影日時、capturedAtSource=exif
      ELSE 空（手入力を求める）。
      捕獲場所も同じ順で決める（全身 → 尻尾 → 空）。撮影情報は写真を縮小する前に読み取った値を使う
    violation: —
    source: [FR2.3]
  - id: BR2.11
    statement: 撮影情報がないときは手で入れる。空のままでは送信できない
    category: validation
    applies_to: Report
    trigger: 内容の確認の画面と POST /v1/reports
    logic: IF capturedAt か location が空 THEN 画面は空欄を示して入力を促し、送信ボタンを押せなくする; サーバーは 400 で拒む
    violation: 400 VALIDATION_FAILED（足りない項目を details に）
    source: [FR2.4]
  - id: BR2.12
    statement: 捕獲日時か捕獲場所のどちらかを手で入れた報告には「日時・位置は手入力」の印を付ける
    category: calculation
    applies_to: Report
    trigger: 報告の保存
    logic: IF capturedAtSource=manual OR locationSource=manual THEN manualEntry=true ELSE manualEntry=false
    violation: —
    source: [FR2.5]
  - id: BR2.13
    statement: 報告に結び付かなかった写真と判別の結果は、受け付けから 24 時間で自動的に消す。報告に結び付いた写真は消さない
    category: policy
    applies_to: Photo
    trigger: 写真の受け付け（期限の設定）と報告の保存（期限の解除）
    logic: >
      IF 写真を受け付けた THEN expiresAt=uploadedAt + 24 時間（判別の結果も同じ期限）;
      IF 報告に結び付いた THEN expiresAt を外す。
      期限を過ぎた写真と判別の結果は、記録も保存場所の実物も自動で消える（自分で動かす処理は作らない。Q4）。
      期限を外す書き込みは「その写真がまだある」ことを条件に行い、自動削除と重ならないようにする（レビュー R-05）
    violation: —
    source: [FR2.9]
  - id: BR2.14
    statement: 報告に使えるのは、受け付けから 24 時間以内の写真だけ
    category: validation
    applies_to: Photo
    trigger: POST /v1/reports
    logic: >
      IF 送信の時刻 - photo.uploadedAt ≤ 24 時間 THEN 使える ELSE 拒む（自動削除が遅れても、古い写真を報告に使わせない。Q4 の補い）。
      確認を通ったあとも、報告に結び付ける書き込み（BR2.13）が「その写真がまだある」ことを条件に行われるため、
      確認と保存の間に自動削除が割り込んだ場合は結び付けに失敗し、報告は保存されない（レビュー R-05）
    violation: 422 VALIDATION_FAILED（写真の期限切れ）
    source: [FR2.9]
  - id: BR2.15
    statement: 捕獲日時は、送信の時刻より 5 分を超えて未来であってはならず、送信の時刻から 7 日より前であってもならない（境界は含む）
    category: validation
    applies_to: Report
    trigger: 内容の確認の画面と POST /v1/reports
    logic: >
      IF capturedAt ≤ 送信の時刻 + 5 分 AND capturedAt ≥ 送信の時刻 - 7 日 THEN 受け付ける ELSE 拒む。
      ちょうど 7 日前、ちょうど 5 分後は受け付ける（AC2.5.3）
    violation: 422 VALIDATION_FAILED（「捕獲日時が未来です」または「捕獲日時が 7 日より前です」）
    source: [FR2.14]
  - id: BR2.16
    statement: 捕獲場所は、設定の対象地域（四角い範囲）の中でなければならない（境界は含む）
    category: validation
    applies_to: Report
    trigger: 内容の確認の画面と POST /v1/reports
    logic: >
      IF targetAreaSouth ≤ lat ≤ targetAreaNorth AND targetAreaWest ≤ lng ≤ targetAreaEast
      THEN 受け付ける ELSE 拒む（Q3。距離の計算は不要）
    violation: 422 VALIDATION_FAILED（「対象地域の外です」）
    source: [FR2.14]
  - id: BR2.17
    statement: U2 の報告には、全身と尻尾の写真・種類・雌雄・成獣／幼獣・捕獲の方法・捕獲日時・捕獲場所が必須。クマのときは胸の写真か「胸の写真なし」の印が必須
    category: validation
    applies_to: Report
    trigger: POST /v1/reports
    logic: >
      IF kind=body の写真 AND kind=tail の写真 AND species AND sex AND ageClass AND captureMethod AND capturedAt AND location
      AND (species≠bear OR kind=chest の写真 OR chestPhotoMissing=true) THEN 受け付ける ELSE 拒む
    violation: 400 VALIDATION_FAILED（足りない項目を details に）
    source: [FR2.1, FR2.13, FR4.1, FR5.1, FR5.2]
  - id: BR2.18
    statement: クマ以外の報告に胸の写真は結び付けられない
    category: constraint
    applies_to: Report
    trigger: POST /v1/reports
    logic: IF species≠bear AND kind=chest の写真が送られた THEN 拒む
    violation: 422 VALIDATION_FAILED（種類と写真の組み合わせが合わない）
    source: [FR2.13]
  - id: BR2.19
    statement: 報告の作成をやめるときは確かめ、「消す」を選んだら入力内容を消す。下書きは残さない
    category: policy
    applies_to: Report
    trigger: 作成中にホームへ戻るとき、「送るのをやめる」を押したとき
    logic: >
      「写真と入力内容は消えます。よろしいですか？」と確かめる;
      IF 「消す」 THEN 画面の入力を消してホームに戻る（受け付け済みの写真は BR2.13 の 24 時間で消える。Q8）;
      IF 「続ける」 THEN 作成中の画面に戻り、内容を残す
    violation: —
    source: [FR2.9, FR7.3]
  - id: BR2.20
    statement: 報告には、自動判別の結果（判別できなかったことを含む）と、ハンターが最終的に選んだ種類の両方を記録する
    category: policy
    applies_to: Report
    trigger: 報告の保存
    logic: >
      autoDetectionOutcome と（detected のときは）autoDetectedSpecies・autoDetectionConfidence を、
      全身の写真の判別の結果から写す。species はハンターが選んだ種類を入れる
    violation: —
    source: [FR3.4]

  # BR6 種類の自動判別（SpeciesDetection）
  - id: BR6.1
    statement: 3 種類のうち確からしさが最も高いものが 80% 以上なら「判別できた」、未満なら「判別できなかった」とする（境界は含む）
    category: calculation
    applies_to: DetectionResult
    trigger: POST /internal/v1/species-detections（全身の写真のアップロードの完了のたび）
    logic: >
      クマ・イノシシ・シカの確からしさのうち最大のものを取り、
      IF 最大 ≥ 80% THEN outcome=detected、species=その種類、confidence=その値
      ELSE outcome=undetected、failureReason=low-confidence（動物が見つからないときは no-animal）
    violation: —
    source: [FR3.1, FR3.3]
  - id: BR6.2
    statement: 種類の判別は、全身の写真のアップロードが終わるたびに行い、写真ごとに結果を残す
    category: policy
    applies_to: DetectionResult
    trigger: POST /v1/photos/{photoId}/complete
    logic: >
      IF kind=body THEN 判別を頼み、結果を保存して画面に返す;
      IF kind≠body THEN 判別しない（結果なしを返す）。
      写真を選び直したら新しい写真の結果ができ、前の写真の結果は写真とともに 24 時間で消える（Q6・Q8・BR2.13）
    violation: —
    source: [FR3.1]
  - id: BR6.3
    statement: 判別のサービスが失敗・時間切れでも「判別できなかった」として返し、報告の作成は止めない
    category: policy
    applies_to: DetectionResult
    trigger: 判別のサービスの呼び出し
    logic: >
      IF サービスが失敗 OR 時間切れ THEN outcome=undetected、failureReason=service-error または timeout で結果を返す（呼び出し自体は成功とする）。
      画面は「判別できませんでした」として、何も選ばれていない状態で種類の確認の画面を出す
    violation: —
    source: [FR3.3]
  - id: BR6.4
    statement: 判別できたときはその種類を選んだ状態で出し、ハンターは別の種類に直せる。「次へ」を押すまで種類は確定しない
    category: policy
    applies_to: Report
    trigger: 種類の確認の画面
    logic: >
      IF outcome=detected THEN その種類を選んだ状態にし、「AI の判定（<confidence>%）」と添える
      ELSE 何も選ばれていない状態にし、手で選ぶよう案内する。
      どちらの場合も、ハンターが選び直せる。「次へ」で species が確定する
    violation: —
    source: [FR3.1, FR3.2, FR3.3]
  - id: BR6.5
    statement: 判別の結果を読めるのは、その写真を送ったハンターだけ
    category: authorization
    applies_to: DetectionResult
    trigger: POST /v1/photos/{photoId}/complete
    logic: IF photo.uploadedByAccountId = 送った人 THEN 返す ELSE 拒む
    violation: 403 FORBIDDEN
    source: [NFR4]

  # BR7 送信の前の知らせ（Reporting・HunterApp）
  - id: BR7.1
    statement: 送信のとき、保存の前に重複の疑いを確かめる。疑いがあり、まだ確認していなければ、保存せずに知らせを返す
    category: policy
    applies_to: Report
    trigger: POST /v1/reports
    logic: >
      IF confirmedNotDuplicate=false THEN DuplicateDetection に問い合わせ;
      IF 疑いがある THEN 保存せず 409 DUPLICATE_SUSPECTED を返し、相手の種類・捕獲日時・おおよその距離を添える;
      IF 疑いがない THEN 保存に進む
    violation: 409 DUPLICATE_SUSPECTED
    source: [FR7.1]
  - id: BR7.2
    statement: 「別の個体なので送る」を選んだ送信は、重複の問い合わせをせずに保存する
    category: policy
    applies_to: Report
    trigger: POST /v1/reports（confirmedNotDuplicate=true）
    logic: IF confirmedNotDuplicate=true THEN 送信の前の問い合わせを省いて保存する（保存のあとの判定〈BR8.4〉で疑いの印は付く）
    violation: —
    source: [FR7.2]
  - id: BR7.3
    statement: ハンターに見せる重複の知らせには、相手の種類・捕獲日時・おおよその距離だけを入れる。氏名と写真は入れない
    category: policy
    applies_to: DuplicateSuspicion
    trigger: 409 DUPLICATE_SUSPECTED の応答
    logic: >
      相手ごとに species・capturedAt・distanceMeters（100 m 単位に丸める）だけを返す。
      相手の reportId・ハンターの ID・氏名・写真は返さない（自分の報告が相手のときも同じ）
    violation: —
    source: [FR7.1]
  - id: BR7.4
    statement: 「送るのをやめる」を選んだら、確かめたうえで内容を消し、ホームに戻る
    category: policy
    applies_to: Report
    trigger: 重複の知らせの画面
    logic: BR2.19 の確認を出し、「消す」で入力を消してホームに戻る
    violation: —
    source: [FR7.3]

  # BR8 重複の判定（DuplicateDetection）
  - id: BR8.1
    statement: 同じ種類で、距離が基準以内、かつ捕獲日時の差が基準以内の報告を重複の疑いとする（境界は含む）
    category: calculation
    applies_to: DuplicateSuspicion
    trigger: 送信の前の問い合わせ、report.saved を受けたとき
    logic: >
      IF 相手.species = 自分.species AND 距離 ≤ duplicateDistanceMeters AND 捕獲日時の差 ≤ duplicateWindowHours
      THEN 重複の疑い。ちょうど 1,000 m・ちょうど 24 時間も疑いとする
    violation: —
    source: [FR6.1, FR6.2]
  - id: BR8.2
    statement: 距離は、2 地点の緯度・経度から地球を球（半径 6,371 km）とみなして求めた地表の距離とする
    category: calculation
    applies_to: DuplicateSuspicion
    trigger: 重複の判定
    logic: 大円距離（ハバーサイン）で求める。試験では 1 m の誤差を許す
    violation: —
    source: [FR6.2]
  - id: BR8.3
    statement: 比べる相手は「種類＋捕獲日」の索引から、前後の日とあわせて 3 日分を読んで絞る
    category: policy
    applies_to: ReportFootprint
    trigger: 重複の判定
    logic: >
      捕獲日時の日（UTC）の前日・当日・翌日の 3 つの speciesDay（例: boar#2026-11-19 / 20 / 21）を読み、
      読んだ相手ごとに BR8.1 を当てる（Q5）。基準の時間が 24 時間を超える設定では、必要な日数に広げる
    violation: —
    source: [FR6.1]
  - id: BR8.4
    statement: 報告を保存したあと、もう一度判定し、自分と相手の両方に疑いの印を付ける
    category: policy
    applies_to: DuplicateSuspicion
    trigger: report.saved を受けたとき
    logic: >
      索引に自分を加えてから判定し、見つかった相手ごとに疑いを 2 行（自分→相手、相手→自分）作る。
      ほぼ同時に送られた 2 件が互いに当たるときも、両方に印が付く（AC3.3.1）。
      疑いを作ったら duplicate.suspected の知らせを、行ごとに送る（C14。受け手は ReportCatalog）。
      疑いの印は Reporting の Report には書き戻さない（書き戻す経路が約束にない。レビュー R-01）
    violation: —
    source: [FR6.4, FR7.2]
  - id: BR8.5
    statement: 送信の前の問い合わせでは、疑いを記録しない
    category: policy
    applies_to: DuplicateSuspicion
    trigger: POST /internal/v1/duplicate-checks
    logic: >
      まだ reportId がないため、答えを返すだけで DuplicateSuspicion は作らず、知らせも送らない。
      「別の個体なので送る」で保存された報告も、保存のあとの判定（BR8.4）で同じ疑いが見つかる（C14）
    violation: —
    source: [FR7.2]
  - id: BR8.6
    statement: 同じ 2 件・同じ種類の疑いは 1 行だけ作る。同じ知らせを 2 回受けても増やさない
    category: constraint
    applies_to: DuplicateSuspicion
    trigger: report.saved を受けたとき
    logic: >
      suspicionId は 2 件の報告の ID（小さいほうを先にする）と kind から決める。
      すでにある組は作り直さない。処理済みの eventId は無視する
    violation: —
    source: [FR6.4]
  - id: BR8.7
    statement: 却下された報告は比べる相手にしない。却下が取り消されたら、また相手にする
    category: policy
    applies_to: ReportFootprint
    trigger: review.status-changed を受けたとき
    logic: >
      IF status=rejected THEN active=false（索引から外す）;
      IF previousStatus=rejected AND undone=true THEN active=true（索引に戻す）。
      判定では savedReceived=true AND active=true の相手だけを比べる（AC3.1.5・BR8.11）
    violation: —
    source: [FR6.1]
  - id: BR8.11
    statement: 却下の知らせが報告の保存の知らせより先に届いても、却下された報告を比べる相手にしない
    category: policy
    applies_to: ReportFootprint
    trigger: review.status-changed と report.saved を受けたとき
    logic: >
      IF review.status-changed を受けて索引の行がない THEN savedReceived=false、active=（status=rejected なら false、そうでなければ true）、
      lastStatusEventAt=知らせの時刻 の行を作る（種類・場所・捕獲日時はまだ入れないため、索引から引かれない）;
      IF report.saved を受けて行がすでにある THEN 種類・場所・捕獲日時・speciesDay・hunterAccountId を入れ、savedReceived=true にし、
      先に覚えた active はそのまま残す;
      IF review.status-changed が、すでに覚えた lastStatusEventAt より古い THEN 無視する（contract-summary 2.5。レビュー R-02）
    violation: —
    source: [FR6.1]
  - id: BR8.8
    statement: すでに付いた重複の疑いは、相手が却下されても消さない
    category: policy
    applies_to: DuplicateSuspicion
    trigger: review.status-changed（却下）を受けたとき
    logic: >
      索引（ReportFootprint.active）だけを変え、DuplicateSuspicion の行はそのまま残す。
      依頼元の画面では、相手の報告の状態（却下）を一緒に表示する（Q7）
    violation: —
    source: [FR8.3]
  - id: BR8.9
    statement: 重複の疑いの相手の一覧を読めるのは依頼元だけ
    category: authorization
    applies_to: DuplicateSuspicion
    trigger: GET /v1/duplicates/{reportId}
    logic: IF role=requester THEN 返す ELSE 拒む（ハンターは送信の前の知らせだけを見る。BR7.3）
    violation: 403 FORBIDDEN
    source: [FR8.3, NFR4]
  - id: BR8.10
    statement: 基準を変えたあとに送られた報告から、新しい基準で判定する
    category: policy
    applies_to: DuplicateSuspicion
    trigger: 重複の判定
    logic: 判定のたびに Settings から基準を読む。すでに付いた疑いは付け直さない
    violation: —
    source: [FR6.3]

  # BR9 設定（Settings）
  - id: BR9.1
    statement: 設定を読めるのは、ログインしている利用者とほかの部品。変えられるのは管理者だけ
    category: authorization
    applies_to: Setting
    trigger: GET /internal/v1/settings、GET /v1/report-settings
    logic: >
      IF 呼び出し元がログイン済みの利用者（画面からの GET /v1/report-settings、Reporting からの内部の呼び出し）
      OR contract-summary 2.1b の表にある部品の身元の証明（DuplicateDetection の保存後の再判定からの内部の呼び出し）
      THEN 設定を返す（対象地域は報告の作成に要る。ADR-010）ELSE 拒む;
      変更は U4 で作る（U2 は読み出しだけ）。
      部品の身元の証明での呼び出しを拒まないこと（レビュー R-03。知らせで動く処理には利用者の証明がない）
    violation: 401 UNAUTHENTICATED / 403 FORBIDDEN
    source: [FR6.3, FR10.1]
  - id: BR9.2
    statement: 設定の値には範囲がある。距離は 1 m 以上、時間は 1 時間以上、対象地域は北 > 南・東 > 西
    category: validation
    applies_to: Setting
    trigger: 設定の保存（U4 の変更の操作。U2 は初期値の作成のみ）
    logic: >
      IF duplicateDistanceMeters ≥ 1 AND duplicateWindowHours ≥ 1
      AND targetAreaNorth > targetAreaSouth AND targetAreaEast > targetAreaWest THEN 受け付ける ELSE 拒む（Q3）
    violation: 422 VALIDATION_FAILED（範囲外）
    source: [FR10.1]
  - id: BR9.3
    statement: 設定がまだ作られていないときは、初期値を使う
    category: policy
    applies_to: Setting
    trigger: 設定の読み出し
    logic: >
      IF 設定の行がない THEN 初期値（1,000 m・24 時間・日本の範囲）を返す。
      最初のデプロイで行を作らなくても、報告と判定が動く
    violation: —
    source: [FR6.1, FR2.14]
```

## 決まりのまとめ

| 決まり | 内容 | 出典 |
|---|---|---|
| BR2.2・BR2.6・BR2.7・BR2.9 | U1 から引き継ぐ決まり（写真の形式と縮小、送信のキー、保存の知らせ、アップロードの完了の確認）。BR2.2 は JPEG だけを受け付ける形に変えた | FR2.2・FR2.8・FR2.11・FR2.12 |
| BR2.10〜BR2.12 | 撮影情報からの日時・場所、手入力、手入力の印 | FR2.3・FR2.4・FR2.5 |
| BR2.13・BR2.14 | 24 時間の自動削除と、古い写真を使わせない確認 | FR2.9 |
| BR2.15・BR2.16 | 捕獲日時（未来 5 分・7 日前）と対象地域（四角い範囲）の確認 | FR2.14 |
| BR2.17・BR2.18 | 完全な報告の必須の項目、クマと胸の写真 | FR2.1・FR2.13・FR4.1・FR5.1 |
| BR2.19・BR2.20 | 作成をやめるときの確認、自動判別の記録 | FR2.9・FR3.4 |
| BR6.1〜BR6.5 | 判別の基準 80%、呼ぶ時機、失敗しても止めない、直せる、読める人 | FR3.1〜FR3.4 |
| BR7.1〜BR7.4 | 送信の前の問い合わせ、確認後の送信、見せる範囲、やめる | FR7.1〜FR7.3 |
| BR8.1〜BR8.11 | 重複の基準と距離、候補の絞り方、保存後の再判定、重複の除去、却下の扱い、知らせの順番の入れ替わり、読める人、基準の適用 | FR6.1〜FR6.4・FR8.3 |
| BR9.1〜BR9.3 | 設定の読み書きの権限、値の範囲、初期値 | FR6.3・FR10.1・FR2.14 |

## Assumptions & Open Questions

- BR7.3 の「おおよその距離」は 100 m 単位に丸める。細かい距離から相手の場所が推測されないようにするため。 [assumption]
- BR8.3 の 3 日分は、基準の時間が 24 時間以下のときの値。基準を 48 時間などに変えた場合は、読む日数を広げる（`ceil(基準の時間 / 24) + 1` 日）。 [assumption]
- BR6.1 の「動物が見つからない（no-animal）」と「確からしさが足りない（low-confidence）」は、画面では同じ「判別できませんでした」として扱う。区別は記録にだけ残す。 [assumption]
- U2 では `kind: photo`・`kind: moon-ring` の疑いを作らない（Q1 で次の版に回したため）。データの形は残してある。 [assumption]
