# Entities（データの形）— U2 `u2-report-duplicate`

入力: `construction/u1-skeleton/functional-design/entities.md`（U1 の形。U2 はこれを拡張する）、`inception/domain-design/components.md`（components。データの持ち主）、`inception/contract-design/contract-summary.md`（contract-summary。C2・C5・C6・C9・C11・C12・C14）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、`inception/user-stories/stories.md`（stories）、`inception/requirements-analysis/requirements.md`（requirements）、functional-design-questions.md（Q1〜Q8）。

U2 で使うデータだけを書く。U1 で「U2 で必須」としていた項目は、ここで必須になる。U3・U4 で足す項目は「U2 では空を許す」とし、どの Unit で必須にするかを書く。型は言語に依存しない論理的な型。

```yaml
entities:
  - name: Photo
    owner: Reporting
    description: 写真。報告より先に受け付け、送信のときに報告と結び付ける（ADR-009）。U2 で尻尾・胸と撮影情報が本番になる
    attributes:
      - { name: photoId, type: identifier, required: true, unique: true }
      - { name: uploadedByAccountId, type: reference, references: Account, required: true }
      - { name: reportId, type: reference, references: Report, required: false, note: "送信までは空" }
      - { name: kind, type: enum, required: true, allowed: [body, tail, chest], note: "U2 で tail・chest も使う" }
      - { name: storageKey, type: string, required: true, unique: true }
      - { name: contentType, type: enum, required: true, allowed: [image/jpeg], note: "端末で長辺 2,048 px の JPEG に縮小してから送るため、受け付けるのは JPEG だけ（BR2.2）。選ぶ時点の JPEG・PNG・HEIC の確認は画面が行う" }
      - { name: sizeBytes, type: integer, required: true, min: 1, max: 15728640 }
      - { name: uploadStatus, type: enum, required: true, allowed: [pending, uploaded], default: pending }
      - { name: exifCapturedAt, type: datetime, required: false, note: "画面が縮小の前に読み取って送る。無いときは空（BR2.10）" }
      - { name: exifLocation, type: geo-point, required: false, note: "同上。無いときは空" }
      - { name: uploadedAt, type: datetime, required: true }
      - { name: expiresAt, type: datetime, required: true, note: "uploadedAt + 24 時間。報告に結び付くとき消す（BR2.13）。自動削除のきっかけ（Q4）" }
    constraints:
      - "1 つの報告に、kind ごとに写真は 1 枚まで"
      - "報告に使えるのは uploadedAt から 24 時間以内の写真だけ（自動削除が遅れても古い写真を使わせない。BR2.14）"

  - name: DetectionResult
    owner: SpeciesDetection
    description: 全身の写真 1 枚ごとの種類の自動判別の結果。判別できなかった場合も結果として残す
    attributes:
      - { name: detectionId, type: identifier, required: true, unique: true }
      - { name: photoId, type: reference, references: Photo, required: true, unique: true, note: "写真 1 枚に結果は 1 つ。選び直すと新しい写真の結果ができる（Q6・Q8）" }
      - { name: outcome, type: enum, required: true, allowed: [detected, undetected], note: "最高の確からしさが 80% 以上なら detected（BR6.1）。サービスの失敗も undetected（BR6.3）" }
      - { name: species, type: enum, required: "outcome=detected のとき", allowed: [bear, boar, deer] }
      - { name: confidence, type: decimal, required: "outcome=detected のとき", min: 0, max: 100, note: "百分率。画面に「AI の判定（92%）」と出す" }
      - { name: rawLabels, type: list-of-object, required: false, note: "判別のサービスが返したラベルと確からしさ。あとで基準を見直すための記録" }
      - { name: failureReason, type: enum, required: false, allowed: [low-confidence, no-animal, service-error, timeout], note: "undetected の理由。画面の文言は変えない（BR6.3）" }
      - { name: detectedAt, type: datetime, required: true }
      - { name: expiresAt, type: datetime, required: true, note: "写真と同じ uploadedAt + 24 時間。報告に結び付くとき消す（BR2.13）" }

  - name: Report
    owner: Reporting
    description: ハンターの報告の内容。送ったあとは変わらない。U2 で完全な形になる
    attributes:
      - { name: reportId, type: identifier, required: true, unique: true }
      - { name: submissionKey, type: string, required: true, unique: true, note: "画面が作る送信のキー（二重送信の防止）" }
      - { name: hunterAccountId, type: reference, references: Account, required: true }
      - { name: hunterNumber, type: string, required: true, note: "送信の時点のアカウントの写し" }
      - { name: capturedAt, type: datetime, required: true, note: "U2 は写真の撮影日時（exif）か手入力（BR2.10・BR2.11）。U1 の「受け付けた時刻」をやめる" }
      - { name: capturedAtSource, type: enum, required: true, allowed: [exif, manual], note: "U2 で device をやめる" }
      - { name: location, type: geo-point, required: true, note: "写真の位置（exif）か、地図で指した場所" }
      - { name: locationSource, type: enum, required: true, allowed: [exif, manual] }
      - { name: placeName, type: string, required: false, note: "U2 では空のまま（Q2）。一覧・詳細は緯度・経度を表示する" }
      - { name: manualEntry, type: boolean, required: true, note: "capturedAtSource か locationSource のどちらかが manual なら true（BR2.12）" }
      - { name: species, type: enum, required: true, allowed: [bear, boar, deer], note: "ハンターが最終的に選んだ種類" }
      - { name: autoDetectedSpecies, type: enum, required: false, allowed: [bear, boar, deer], note: "自動判別の種類。判別できなかったときは空（BR6.4）" }
      - { name: autoDetectionOutcome, type: enum, required: true, allowed: [detected, undetected], note: "判別できたかどうか。依頼元が直された報告を見分けるため（FR3.4）" }
      - { name: autoDetectionConfidence, type: decimal, required: "autoDetectionOutcome=detected のとき", min: 0, max: 100 }
      - { name: sex, type: enum, required: true, allowed: [male, female, unknown] }
      - { name: ageClass, type: enum, required: true, allowed: [adult, juvenile], note: "U2 で必須（U1 は空を許していた）" }
      - { name: captureMethod, type: enum, required: true, allowed: [trap, gun, other], note: "U2 で必須" }
      - { name: chestPhotoMissing, type: boolean, required: "species=bear のとき", note: "クマで胸の写真を撮らなかったとき true（BR2.8）。クマ以外では空" }
      - { name: confirmedNotDuplicate, type: boolean, required: true, default: false, note: "送信の前の知らせで「別の個体なので送る」を選んだ（BR7.2）。Reporting が送信のときに自分で入れる" }
      - { name: submittedAt, type: datetime, required: true }
    constraints:
      - "全身の写真（kind=body）と尻尾の写真（kind=tail）が 1 枚ずつ、必ず結び付く（BR2.17）"
      - "species=bear かつ chestPhotoMissing=false のときは、胸の写真（kind=chest）が 1 枚結び付く"
      - "species≠bear のときは、胸の写真を結び付けられない"
      - "重複の疑いの印は Report に持たせない。疑いは DuplicateDetection が持ち（DuplicateSuspicion）、一覧は ReportCatalog の ReportListItem.duplicateSuspected が持つ（C14 で更新される）。DuplicateDetection から Reporting への書き戻しの経路は約束にないため（レビュー R-01）"

  - name: ReportFootprint
    owner: DuplicateDetection
    description: 重複の判定に使う索引。報告の「種類・場所・日時」の写しだけを持ち、氏名・写真は持たない（FR7.1）
    attributes:
      - { name: reportId, type: reference, references: Report, required: true, unique: true }
      - { name: savedReceived, type: boolean, required: true, default: false, note: "report.saved が届いたか。却下の知らせが先に届いた行は false で作り、比べる相手にしない（contract-summary 2.5。レビュー R-02）" }
      - { name: species, type: enum, required: "savedReceived=true のとき", allowed: [bear, boar, deer] }
      - { name: location, type: geo-point, required: "savedReceived=true のとき" }
      - { name: capturedAt, type: datetime, required: "savedReceived=true のとき" }
      - { name: speciesDay, type: string, required: "savedReceived=true のとき", note: "索引のキー。種類と捕獲日（UTC）の組（例: boar#2026-11-20）。前後の日とあわせて 3 日分を読む（Q5・BR8.3）。savedReceived=false の行はこのキーを持たないため、索引から引かれない" }
      - { name: active, type: boolean, required: true, default: true, note: "却下された報告は比べる相手にしない（false）。却下の取り消しで true に戻す（ADR-003）。却下の知らせが先に届いたときは、この値だけを先に覚えておく" }
      - { name: photoHash, type: string, required: false, note: "Should（写真の重複）用。U2 では空のまま（Q1）" }
      - { name: hunterAccountId, type: reference, references: Account, required: "savedReceived=true のとき", note: "送信の前の問い合わせで、自分の報告と他人の報告を区別するため（氏名は持たない）" }
      - { name: addedAt, type: datetime, required: true }
      - { name: lastSavedEventAt, type: datetime, required: false, note: "report.saved の知らせの時刻（順番の判定用。contract-summary 2.5）" }
      - { name: lastStatusEventAt, type: datetime, required: false, note: "review.status-changed の知らせの時刻（古い知らせで上書きしないため）" }
      - { name: processedEventIds, type: list-of-identifier, required: true, default: [], note: "2 回目の知らせを無視するため" }

  - name: DuplicateSuspicion
    owner: DuplicateDetection
    description: 重複の疑い。報告 2 件を結ぶ。疑いの組ごとに 2 行（A→B と B→A）作る（C14）
    attributes:
      - { name: suspicionId, type: identifier, required: true, unique: true, note: "reportId と matchedReportId と kind の組から決まる（同じ組を 2 回作らない。BR8.6）" }
      - { name: reportId, type: reference, references: Report, required: true, note: "印を付ける報告" }
      - { name: matchedReportId, type: reference, references: Report, required: true, note: "疑いの相手の報告" }
      - { name: kind, type: enum, required: true, allowed: [place-time, photo, moon-ring], default: place-time, note: "U2 は place-time だけ（Q1。photo・moon-ring は次の版）" }
      - { name: distanceMeters, type: integer, required: "kind=place-time のとき", min: 0 }
      - { name: hoursApart, type: decimal, required: "kind=place-time のとき", min: 0 }
      - { name: phase, type: enum, required: true, allowed: [pre-submit, post-save], note: "どの段で見つけたか。pre-submit は記録せず答えるだけなので、保存されるのは post-save だけ（BR8.5）" }
      - { name: detectedAt, type: datetime, required: true }
    constraints:
      - "reportId と matchedReportId は別の報告（自分自身とは結ばない）"
      - "相手が却下されても、この行は消さない（Q7。依頼元の画面で相手の状態を併記する）"

  - name: Setting
    owner: Settings
    description: 重複の基準と対象地域。U2 は読み出しと初期値だけを作る（変更の画面は U4）
    attributes:
      - { name: settingKey, type: string, required: true, unique: true, note: "1 行だけ（固定の値）" }
      - { name: duplicateDistanceMeters, type: integer, required: true, min: 1, default: 1000, note: "初期値 1 km（FR6.1）" }
      - { name: duplicateWindowHours, type: integer, required: true, min: 1, default: 24, note: "初期値 24 時間（FR6.1）" }
      - { name: targetAreaNorth, type: decimal, required: true, min: -90, max: 90, default: 46, note: "四角い範囲の北の緯度（Q3）" }
      - { name: targetAreaSouth, type: decimal, required: true, min: -90, max: 90, default: 20, note: "南の緯度" }
      - { name: targetAreaEast, type: decimal, required: true, min: -180, max: 180, default: 154, note: "東の経度" }
      - { name: targetAreaWest, type: decimal, required: true, min: -180, max: 180, default: 122, note: "西の経度" }
      - { name: updatedByAccountId, type: reference, references: Account, required: false, note: "初期値のままのときは空。U4 の変更で入る" }
      - { name: updatedAt, type: datetime, required: true }
    constraints:
      - "targetAreaNorth > targetAreaSouth かつ targetAreaEast > targetAreaWest（BR9.2）"
      - "初期値は日本の範囲（北緯 20〜46 度・東経 122〜154 度。requirements FR2.14）"

relationships:
  - { from: Account, to: Report, cardinality: "1 対 多", direction: "1 人のハンターが多くの報告を送る" }
  - { from: Report, to: Photo, cardinality: "1 対 2〜3", direction: "報告は全身・尻尾（クマは胸も）の写真を持つ" }
  - { from: Account, to: Photo, cardinality: "1 対 多", direction: "1 人のハンターが写真をアップロードする（報告の前から）" }
  - { from: Photo, to: DetectionResult, cardinality: "1 対 0〜1", direction: "全身の写真だけが判別の結果を 1 つ持つ" }
  - { from: Report, to: ReportFootprint, cardinality: "1 対 1", direction: "報告ごとに索引が 1 つ" }
  - { from: Report, to: DuplicateSuspicion, cardinality: "1 対 多", direction: "報告は複数の相手と疑いで結ばれる" }
  - { from: Setting, to: Report, cardinality: "1 対 多", direction: "対象地域の確認に使う（読むだけ）" }
  - { from: Setting, to: DuplicateSuspicion, cardinality: "1 対 多", direction: "距離と時間の基準に使う（読むだけ）" }
```

## まとめ

| データ | 持ち主 | U2 での役割 | U1 からの変化 |
|---|---|---|---|
| Photo | Reporting | 全身・尻尾・胸の 3 種類。撮影情報（日時・位置）を持ち、24 時間で自動的に消える | `exifCapturedAt`・`exifLocation` が本番に。`expiresAt` を足した |
| DetectionResult | SpeciesDetection | 全身の写真の種類の自動判別の結果。判別できなかった理由も残す | 新しく作る |
| Report | Reporting | 完全な報告。成獣／幼獣・捕獲の方法が必須になり、自動判別の記録を持つ | `capturedAt` の決め方が変わり、U1 で空だった項目が必須に |
| ReportFootprint | DuplicateDetection | 重複の判定に使う索引。「種類＋捕獲日」で引ける。知らせの順番が入れ替わっても正しく組み立てる | 新しく作る |
| DuplicateSuspicion | DuplicateDetection | 重複の疑い。組ごとに 2 行 | 新しく作る |
| Setting | Settings | 重複の基準と対象地域（四角い範囲）。U2 は読み出しと初期値だけ | 新しく作る |

Account・ReviewDecision・ReportListItem は U1 の形のまま使う（U2 で変えない）。`ReportListItem.duplicateSuspected` は U1 で用意済みで、U2 が `duplicate.suspected` の知らせを送ることで初めて true になる（一覧への表示は U3）。

**重複の疑いの印は、どこが持つか**（レビュー R-01）。Reporting の `Report` には持たせない。DuplicateDetection から Reporting へ書き戻す経路が約束（contract-summary）にないためで、持たせても永遠に `false` のままになる。疑いの正本は DuplicateDetection の `DuplicateSuspicion` で、依頼元は C5 `GET /v1/duplicates/{reportId}` で読む。一覧の印は `ReportListItem.duplicateSuspected` が持ち、C14 `duplicate.suspected` の知らせで更新される。

## Assumptions & Open Questions

- `speciesDay` の日付は UTC で切る。日本時間の深夜に捕獲された報告は、前後の日とあわせて 3 日分を読むため、時差で取りこぼすことはない。 [assumption]
- `rawLabels` は判別のサービスが返した上位のラベル（5 件程度）を想定。件数の上限は Code Generation で決める。 [assumption]
- `Setting` は 1 行だけ持つ。複数の対象地域（飛び地）には対応しない。 [assumption]
- `suspicionId` を「2 件の報告の ID と kind の組」から決めるため、同じ組を 2 回作らない。並びは、小さいほうの ID を先にして揃える。 [assumption]
