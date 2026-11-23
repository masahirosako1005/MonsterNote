# Entities（データの形）— U1 `u1-skeleton`

入力: `inception/domain-design/components.md`（components。データの持ち主）、`inception/contract-design/contract-summary.md`（contract-summary）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、`inception/user-stories/stories.md`（stories）、`inception/requirements-analysis/requirements.md`（requirements）、functional-design-questions.md（Q1〜Q6）。

U1 で使うデータだけを書く。U2 以降で足す項目は「U1 では空を許す」とし、どの Unit で必須にするかを書く（Q1）。型は言語に依存しない論理的な型。

```yaml
entities:
  - name: Account
    owner: Accounts
    description: 利用者のアカウント。U1 ではスクリプトで作る（Q5）
    attributes:
      - { name: accountId, type: identifier, required: true, unique: true }
      - { name: loginId, type: string, required: true, unique: true, constraints: "英数字 3〜32 文字" }
      - { name: displayName, type: string, required: true, constraints: "1〜50 文字" }
      - { name: role, type: enum, required: true, allowed: [hunter, requester, admin] }
      - { name: organization, type: enum, required: "role=requester のとき", allowed: [municipality, hunters-association] }
      - { name: status, type: enum, required: true, allowed: [active, disabled], default: active }
      - { name: mustChangePassword, type: boolean, required: true, default: true, note: "U1 では変更の画面がないため、スクリプトで false にして作る。U4 で true の流れを作る" }
      - { name: consentedAt, type: datetime, required: "role=hunter のとき（U1 ではスクリプトで入れる）" }
      - { name: hunterNumber, type: string, required: "role=hunter のとき", constraints: "数字 1〜20 桁" }
      - { name: createdAt, type: datetime, required: true }
    constraints:
      - "role=hunter のとき、consentedAt と hunterNumber がないと報告できない（BR2.1）"

  - name: Photo
    owner: Reporting
    description: 写真。報告より先に受け付け、送信のときに報告と結び付ける（ADR-009）
    attributes:
      - { name: photoId, type: identifier, required: true, unique: true }
      - { name: uploadedByAccountId, type: reference, references: Account, required: true }
      - { name: reportId, type: reference, references: Report, required: false, note: "送信までは空" }
      - { name: kind, type: enum, required: true, allowed: [body, tail, chest], note: "U1 では body だけ" }
      - { name: storageKey, type: string, required: true, unique: true }
      - { name: contentType, type: enum, required: true, allowed: [image/jpeg, image/png, image/heic] }
      - { name: sizeBytes, type: integer, required: true, min: 1, max: 15728640 }
      - { name: uploadStatus, type: enum, required: true, allowed: [pending, uploaded], default: pending, note: "報告に結び付いたかは reportId の有無で分かる（BR2.9）" }
      - { name: exifCapturedAt, type: datetime, required: false, note: "U1 では使わない（U2）" }
      - { name: exifLocation, type: geo-point, required: false, note: "U1 では使わない（U2）" }
      - { name: uploadedAt, type: datetime, required: true }
    constraints:
      - "1 つの報告に、kind ごとに写真は 1 枚まで"

  - name: Report
    owner: Reporting
    description: ハンターの報告の内容。送ったあとは変わらない
    attributes:
      - { name: reportId, type: identifier, required: true, unique: true }
      - { name: submissionKey, type: string, required: true, unique: true, note: "画面が作る送信のキー（二重送信の防止）" }
      - { name: hunterAccountId, type: reference, references: Account, required: true }
      - { name: hunterNumber, type: string, required: true, note: "送信の時点のアカウントの写し" }
      - { name: capturedAt, type: datetime, required: true, note: "U1 は Reporting が受け付けた時刻（BR2.5。スマホの時計のずれを避ける）" }
      - { name: capturedAtSource, type: enum, required: true, allowed: [device, exif, manual], note: "U1 は device だけ" }
      - { name: location, type: geo-point, required: true, note: "U1 は送信の時点のスマホの位置（Q2）" }
      - { name: locationSource, type: enum, required: true, allowed: [device, exif, manual], note: "U1 は device だけ" }
      - { name: placeName, type: string, required: false, note: "U2 で地図のサービスから入れる。U1 は空" }
      - { name: species, type: enum, required: true, allowed: [bear, boar, deer] }
      - { name: sex, type: enum, required: true, allowed: [male, female, unknown] }
      - { name: ageClass, type: enum, required: false, allowed: [adult, juvenile], note: "U1 は空。U2 で必須" }
      - { name: captureMethod, type: enum, required: false, allowed: [trap, gun, other], note: "U1 は空。U2 で必須" }
      - { name: chestPhotoMissing, type: boolean, required: false, note: "U2" }
      - { name: autoDetectionId, type: reference, references: DetectionResult, required: false, note: "U2" }
      - { name: submittedAt, type: datetime, required: true }
    constraints:
      - "全身の写真（kind=body）が 1 枚、必ず結び付く"

  - name: ReviewDecision
    owner: Review
    description: 報告の状態。報告 1 件に 1 つ
    attributes:
      - { name: reportId, type: reference, references: Report, required: true, unique: true }
      - { name: hunterAccountId, type: reference, references: Account, required: true, note: "report.saved の写し。ハンターが自分の報告の状態だけを読めるようにするため（BR3.5）" }
      - { name: status, type: enum, required: true, allowed: [checking, approved, rejected], default: checking, note: "U1 は checking と approved だけ" }
      - { name: reason, type: enum, required: false, allowed: [duplicate, insufficient-photo, out-of-scope, other], note: "U3" }
      - { name: reasonText, type: string, required: false, note: "U3" }
      - { name: decidedByAccountId, type: reference, references: Account, required: "status が checking 以外のとき" }
      - { name: decidedByName, type: string, required: "status が checking 以外のとき", note: "ALREADY_DECIDED で返すための写し" }
      - { name: decidedAt, type: datetime, required: "status が checking 以外のとき" }
      - { name: undoUntil, type: datetime, required: false, note: "U3" }
      - { name: submittedAt, type: datetime, required: true }
      - { name: lastEventAt, type: datetime, required: true, note: "知らせの順番の判定用（contract-summary 2.5）" }

  - name: ReportListItem
    owner: ReportCatalog
    description: 一覧の 1 行（知らせから作る写し）
    attributes:
      - { name: reportId, type: reference, references: Report, required: true, unique: true }
      - { name: hunterAccountId, type: reference, references: Account, required: "report.saved が届いたあと" }
      - { name: hunterName, type: string, required: "report.saved が届いたあと" }
      - { name: species, type: enum, allowed: [bear, boar, deer], required: "report.saved が届いたあと" }
      - { name: capturedAt, type: datetime, required: "report.saved が届いたあと" }
      - { name: placeName, type: string, required: false }
      - { name: status, type: enum, allowed: [checking, approved, rejected], required: true, default: checking }
      - { name: duplicateSuspected, type: boolean, required: true, default: false, note: "U3" }
      - { name: manualEntry, type: boolean, required: true, default: false, note: "U3 で表示" }
      - { name: submittedAt, type: datetime, required: "report.saved が届いたあと" }
      - { name: savedReceived, type: boolean, required: true, default: false, note: "report.saved が届いたか（状態だけ先に届いた行は一覧に出さない）" }
      - { name: lastSavedEventAt, type: datetime, required: false }
      - { name: lastStatusEventAt, type: datetime, required: false }
      - { name: processedEventIds, type: list-of-identifier, required: true, default: [], note: "2 回目の知らせを無視するため" }

relationships:
  - { from: Account, to: Report, cardinality: "1 対 多", direction: "1 人のハンターが多くの報告を送る" }
  - { from: Report, to: Photo, cardinality: "1 対 1〜3", direction: "報告は写真を持つ（U1 は全身の 1 枚）" }
  - { from: Account, to: Photo, cardinality: "1 対 多", direction: "1 人のハンターが写真を送る（報告の前から）" }
  - { from: Report, to: ReviewDecision, cardinality: "1 対 1", direction: "報告ごとに状態が 1 つ" }
  - { from: Report, to: ReportListItem, cardinality: "1 対 1", direction: "報告ごとに一覧の行が 1 つ" }
  - { from: Account, to: ReviewDecision, cardinality: "1 対 多", direction: "1 人の依頼元が多くの報告を確認する" }
```

## まとめ

| データ | 持ち主 | U1 での役割 |
|---|---|---|
| Account | Accounts | ログインと役割。U1 はスクリプトで、同意済み・従事者番号の登録済みで作る |
| Photo | Reporting | 全身の写真 1 枚。報告の前に受け付け、送信で結び付ける |
| Report | Reporting | 報告の内容。U2 の項目は空を許す |
| ReviewDecision | Review | 状態（確認中・承認）。先着の決まりのため「確認中のときだけ書き換える」 |
| ReportListItem | ReportCatalog | 一覧の行。知らせから作り、状態が先に届いても待つ |

## Assumptions & Open Questions

- loginId の長さ・文字の決まり（英数字 3〜32 文字）と displayName の長さは初期値。 [assumption]
