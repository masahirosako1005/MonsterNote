# Entities（データの形）— U3 `u3-review-list`

入力: `construction/u1-skeleton/functional-design/entities.md`（U1 の形。U3 はこれを拡張する）、`construction/u2-report-duplicate/functional-design/entities.md`（U2 が送る `duplicate.suspected` の知らせ）、`inception/domain-design/components.md`（components。データの持ち主）、`inception/contract-design/contract-summary.md`（contract-summary。C3・C4・C13・C14）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、`inception/user-stories/stories.md`（stories）、`inception/requirements-analysis/requirements.md`（requirements）、functional-design-questions.md（Q1〜Q6）。

U3 は新しいデータを作らない。U1 で作った 2 つ（`ReviewDecision`・`ReportListItem`）に項目を足し、U1 で「U3」と注記していた項目を本番にする。

```yaml
entities:
  - name: ReviewDecision
    owner: Review
    description: 報告の状態。報告 1 件に 1 つ。U3 で却下・取り消し・先着の決まりが本番になる
    attributes:
      - { name: reportId, type: reference, references: Report, required: true, unique: true }
      - { name: hunterAccountId, type: reference, references: Account, required: true, note: "report.saved の写し。ハンターが自分の報告の状態だけを読めるようにするため（BR3.5）" }
      - { name: status, type: enum, required: true, allowed: [checking, approved, rejected], default: checking, note: "U3 で rejected も使う" }
      - { name: reason, type: enum, required: "status=rejected のとき", allowed: [duplicate, insufficient-photo, out-of-scope, other], note: "U3 で本番（U1 は空だった）" }
      - { name: reasonText, type: string, required: "reason=other のとき", constraints: "1〜200 文字（Q6）", note: "ハンターに表示する。U3 で本番" }
      - { name: decidedByAccountId, type: reference, references: Account, required: "status が checking 以外のとき" }
      - { name: decidedByName, type: string, required: "status が checking 以外のとき", note: "ログインの証明の name の写し。無いときは「依頼元の担当者」を入れる。利用者の ID は入れない（Q5。U1 の積み残しの解消）" }
      - { name: decidedAt, type: datetime, required: "status が checking 以外のとき" }
      - { name: undoUntil, type: datetime, required: "status が checking 以外のとき", note: "decidedAt + 10 秒。U3 で本番（U1 は空だった）。取り消せる期限で、他の人の操作を止める期限でもある（BR3.8・BR3.9）" }
      - { name: submittedAt, type: datetime, required: true }
      - { name: lastEventAt, type: datetime, required: true, note: "知らせの順番の判定用（contract-summary 2.5）" }
    constraints:
      - "status=checking のとき、decidedByAccountId・decidedByName・decidedAt・undoUntil・reason・reasonText はすべて空（取り消しで確認中に戻すときに消す。BR3.10）"
      - "status=rejected のとき、reason が必ずある。reason=other のとき reasonText が必ずある（BR3.11）"

  - name: ReportListItem
    owner: ReportCatalog
    description: 一覧の 1 行（知らせから作る写し）。U3 で絞り込みと重複の疑いの印が本番になる
    attributes:
      - { name: reportId, type: reference, references: Report, required: true, unique: true }
      - { name: hunterAccountId, type: reference, references: Account, required: "report.saved が届いたあと" }
      - { name: hunterName, type: string, required: "report.saved が届いたあと" }
      - { name: species, type: enum, allowed: [bear, boar, deer], required: "report.saved が届いたあと" }
      - { name: capturedAt, type: datetime, required: "report.saved が届いたあと" }
      - { name: placeName, type: string, required: false, note: "U2 では空のまま（U2 の Q2）。空のときは画面が緯度・経度を表示する" }
      - { name: location, type: geo-point, required: false, note: "placeName が空のときに一覧へ表示するため、report.saved から写す（U3 で追加。D-2）" }
      - { name: status, type: enum, allowed: [checking, approved, rejected], required: true, default: checking }
      - { name: duplicateSuspected, type: boolean, required: true, default: false, note: "U3 で本番。duplicate.suspected の知らせ（C14。送り手は U2）で true になる。一度 true にしたら戻さない（BR4.6）" }
      - { name: manualEntry, type: boolean, required: true, default: false, note: "U3 で絞り込みと表示に使う。report.saved から写す" }
      - { name: submittedAt, type: datetime, required: "report.saved が届いたあと", note: "「送ってから n 日」と「7 日以上」の印は、これと今の時刻から読み出しのたびに計算する（Q4。データには持たない）" }
      - { name: savedReceived, type: boolean, required: true, default: false, note: "report.saved が届いたか（状態だけ先に届いた行は一覧に出さない）" }
      - { name: lastSavedEventAt, type: datetime, required: false }
      - { name: lastStatusEventAt, type: datetime, required: false }
      - { name: lastDuplicateEventAt, type: datetime, required: false, note: "duplicate.suspected の知らせの時刻（U3 で追加）" }
      - { name: processedEventIds, type: list-of-identifier, required: true, default: [], note: "2 回目の知らせを無視するため" }
    constraints:
      - "「送ってから n 日」「7 日以上」は項目として持たない（読み出しのたびに計算する。Q4）"
      - "絞り込みのための索引は増やさない。新しい順に読んでから条件で除く（Q1）"

relationships:
  - { from: Report, to: ReviewDecision, cardinality: "1 対 1", direction: "報告ごとに状態が 1 つ" }
  - { from: Report, to: ReportListItem, cardinality: "1 対 1", direction: "報告ごとに一覧の行が 1 つ" }
  - { from: Account, to: ReviewDecision, cardinality: "1 対 多", direction: "1 人の依頼元が多くの報告を確認する" }
  - { from: Account, to: ReportListItem, cardinality: "1 対 多", direction: "1 人のハンターの報告が一覧に並ぶ" }
```

## まとめ

| データ | 持ち主 | U3 で変わる点 |
|---|---|---|
| ReviewDecision | Review | `reason`・`reasonText`・`undoUntil` が本番に。`decidedByName` の既定値を「依頼元の担当者」にし、利用者の ID を入れないようにする（Q5） |
| ReportListItem | ReportCatalog | `duplicateSuspected` が本番に（C14 の知らせで更新）。`location` と `lastDuplicateEventAt` を追加。日数と印は持たず、読み出しのたびに計算する（Q4） |

Account・Photo・Report は U1・U2 の形のまま使う（U3 で変えない）。

## Assumptions & Open Questions

- `undoUntil` は「取り消せる期限」と「他の人の操作を止める期限」を兼ねる。別々に持たせない（FR8.5・FR8.6 が同じ 10 秒を指しているため）。 [assumption]
- `reasonText` の 200 文字は、画面で折り返して読める長さの目安。文字数は書記素（見た目の 1 文字）で数える（絵文字や結合文字を 1 文字と数える。corner-checklist「Text」）。 [assumption]
- `duplicateSuspected` を一度 true にしたら false に戻さない。U2 の決まり（BR8.8。相手が却下されても疑いの記録は残す）と合わせるため。 [assumption]
- 一覧に `location` を足すのは、`placeName` が空のあいだ（U2 の Q2）、緯度・経度を表示するため。地名を求めるようになったら、`placeName` が入って `location` は表示に使わなくなる。 [assumption]
