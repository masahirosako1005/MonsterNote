# Entities（データの形）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/functional-design/entities.md`（U1 の Account）、`construction/u2-report-duplicate/functional-design/entities.md`（U2 の Setting）、`construction/u3-review-list/functional-design/entities.md`（U3 の確認の記録）、`inception/domain-design/components.md`（components。Accounts・Settings・AuditLog）・`decisions.md`（ADR-006）、`inception/contract-design/contract-summary.md`（contract-summary。C1・C6・C7・C15・C17）、`inception/units-generation/unit-of-work.md`（unit-of-work）・`unit-of-work-story-map.md`、`inception/user-stories/stories.md`（stories）、`inception/requirements-analysis/requirements.md`（requirements）、functional-design-questions.md（Q1〜Q6）。

U4 は `AuditEntry` を新しく作り、U1 の `Account` に項目を足す（U1 で「U4」と注記していた項目が本番になる）。`Setting` は U2 の形のまま使う（変更の操作だけを足す）。

```yaml
entities:
  - name: Account
    owner: Accounts
    description: 利用者のアカウント。U4 で管理者の画面から作れるようになり、初回の手続きが本番になる
    attributes:
      - { name: accountId, type: identifier, required: true, unique: true }
      - { name: loginId, type: string, required: true, unique: true, constraints: "英数字 3〜32 文字" }
      - { name: displayName, type: string, required: true, constraints: "1〜50 文字" }
      - { name: role, type: enum, required: true, allowed: [hunter, requester, admin], note: "U4 で admin も画面から作れる（最初の 1 人はスクリプト。Q1）" }
      - { name: organization, type: enum, required: "role=requester のとき", allowed: [municipality, hunters-association] }
      - { name: status, type: enum, required: true, allowed: [active, disabled], default: active, note: "U4 で無効化・有効化が本番に" }
      - { name: mustChangePassword, type: boolean, required: true, default: true, note: "U4 で本番。作成とパスワードの再設定で true になり、変更で false になる（BR11.3）。「仮のパスワードかどうか」はこの項目だけが覚える（認証のサービス側では変更を求めない状態にする。レビュー R-01）" }
      - { name: consentedAt, type: datetime, required: false, note: "U4 で本番。ハンターが同意した日時。無いあいだは報告できない（BR11.5）" }
      - { name: consentDeclinedAt, type: datetime, required: false, note: "「同意しない」を押した日時。次のログインでまた同意の画面を出すため、同意の有無は consentedAt で判断する（AC1.3.3）" }
      - { name: hunterNumber, type: string, required: false, constraints: "数字 1〜20 桁", note: "U4 で本番。ハンターが初回に登録する（BR11.6）" }
      - { name: createdAt, type: datetime, required: true }
      - { name: createdByAccountId, type: reference, references: Account, required: false, note: "作った管理者。スクリプトで作った最初の管理者は空" }
      - { name: lastActiveAt, type: datetime, required: false, note: "最後に使った日時（30 日の判定用。U1 の出し直しの仕組みが持っていた値をここに明記する）" }
    constraints:
      - "role=hunter のとき、consentedAt と hunterNumber がそろうまで報告できない（BR11.5・BR11.6）"
      - "role=requester のとき organization が必須（BR11.2）"
      - "有効な管理者が 1 人だけのとき、その管理者は無効にできない（BR11.9。Q5）"

  - name: AdminCounter
    owner: Accounts
    description: 有効な管理者の数。最後の 1 人を無効にできないようにするためだけに持つ（レビュー R-02）
    attributes:
      - { name: counterKey, type: string, required: true, unique: true, note: "1 行だけ（固定の値）" }
      - { name: activeAdminCount, type: integer, required: true, min: 0, note: "有効な管理者の数。管理者を作る・有効に戻すと 1 増え、無効にすると 1 減る" }
      - { name: updatedAt, type: datetime, required: true }
    constraints:
      - "管理者を無効にするときは「2 以上である」ことを条件に 1 減らす（数えてから書く形にしない。BR11.9）"
      - "管理者以外のアカウントの作成・無効化では触れない"

  - name: AuditEntry
    owner: AuditLog
    description: 誰がいつ何をしたかの記録。知らせ（C15）から作り、あとから変えない
    attributes:
      - { name: entryId, type: identifier, required: true, unique: true }
      - { name: occurredAt, type: datetime, required: true, note: "操作が起きた日時（知らせの時刻。並び順の正本）" }
      - { name: recordedAt, type: datetime, required: true, note: "記録を書いた日時（知らせが遅れたときの差が分かる）" }
      - { name: actorAccountId, type: reference, references: Account, required: false, note: "操作した人。仕組みが動かした処理（知らせの受け手など）は空" }
      - { name: actorName, type: string, required: false, note: "操作した人の表示名の写し（アカウントを消しても読めるように）。利用者の ID は画面に出さない（U3 の決まりと同じ）。知らせ（C15）に載せてもらう必要がある（レビュー R-03。functional-spec の D-6）" }
      - { name: action, type: string, required: true, note: "操作の種類（例: report.submitted、review.approved、account.created、settings.updated、data.deleted）" }
      - { name: targetType, type: enum, required: true, allowed: [report, account, settings, data] }
      - { name: targetId, type: string, required: false, note: "対象の ID。settings や全体の削除のように対象が 1 つでないときは空" }
      - { name: outcome, type: enum, required: true, allowed: [succeeded, failed], default: succeeded }
      - { name: detail, type: object, required: false, note: "件数など、ID 以外に必要な最小限だけ（Q6）。パスワード・写真・報告の中身・却下の理由の文は入れない" }
      - { name: eventId, type: identifier, required: true, unique: true, note: "知らせの ID。同じ知らせを 2 回受けても 1 件しか作らない（BR12.2）" }
    constraints:
      - "作ったあとは変えない・消さない（試験運用の終わりの削除でも消さない。Q3・BR12.4）。試験運用そのものを終えるときは、AWS の環境ごと片付けて消す（レビュー R-06）"
      - "パスワード・写真そのもの・報告の中身・却下の理由の文は入れない（AC6.6.3・C15）"

  - name: Setting
    owner: Settings
    description: 重複の基準と対象地域。U2 の形のまま。U4 で変更の操作を足す
    attributes:
      - { name: settingKey, type: string, required: true, unique: true }
      - { name: duplicateDistanceMeters, type: integer, required: true, min: 1, default: 1000 }
      - { name: duplicateWindowHours, type: integer, required: true, min: 1, default: 24 }
      - { name: targetAreaNorth, type: decimal, required: true, min: -90, max: 90, default: 46, note: "四角い範囲（U2 の Q3）" }
      - { name: targetAreaSouth, type: decimal, required: true, min: -90, max: 90, default: 20 }
      - { name: targetAreaEast, type: decimal, required: true, min: -180, max: 180, default: 154 }
      - { name: targetAreaWest, type: decimal, required: true, min: -180, max: 180, default: 122 }
      - { name: updatedByAccountId, type: reference, references: Account, required: false, note: "U4 の変更で入る" }
      - { name: updatedAt, type: datetime, required: true }
    constraints:
      - "targetAreaNorth > targetAreaSouth かつ targetAreaEast > targetAreaWest（U2 の BR9.2）"

relationships:
  - { from: Account, to: Account, cardinality: "1 対 多", direction: "管理者が作ったアカウント（createdByAccountId）" }
  - { from: Account, to: AuditEntry, cardinality: "1 対 多", direction: "1 人の操作が多くの記録になる" }
  - { from: Account, to: Setting, cardinality: "1 対 多", direction: "管理者が設定を変える（updatedByAccountId）" }
```

## まとめ

| データ | 持ち主 | U4 での役割 | U1・U2 からの変化 |
|---|---|---|---|
| Account | Accounts | 管理者の画面から作成・再設定・無効化。初回の手続き（パスワード・同意・従事者番号）が本番に | `mustChangePassword`・`consentedAt`・`hunterNumber`・`status` が本番に。`consentDeclinedAt`・`createdByAccountId`・`lastActiveAt` を追加。`role=admin` を画面から作れるように |
| AdminCounter | Accounts | 有効な管理者の数。最後の 1 人を無効にできないようにするためだけに持つ | 新しく作る（レビュー R-02） |
| AuditEntry | AuditLog | 操作の記録。知らせから作り、あとから変えない | 新しく作る |
| Setting | Settings | 重複の基準と対象地域。変更の操作を足す | U2 の形のまま（`updatedByAccountId` が入るようになる） |

Photo・Report・DetectionResult・ReportFootprint・DuplicateSuspicion・ReviewDecision・ReportListItem は、U1〜U3 の形のまま使う。U4 は**削除の入口**を各部品に足すだけで、データの形は変えない（ADR-006）。

## Assumptions & Open Questions

- `lastActiveAt` は、U1 で出し直しの仕組みが持っていた「最後の利用」を、データの形としてはっきり書いたもの。30 日の判定に使う（FR1.6）。 [assumption]
- `consentDeclinedAt` は記録のためだけに持つ。同意の有無の判断は `consentedAt` の有無で行う（「同意しない」を押しても、次のログインでまた同意の画面が出る。AC1.3.3）。 [assumption]
- `AuditEntry.detail` に入れるのは、件数（削除の件数など）や設定の項目名といった、ID 以外に必要な最小限だけ。変更の前後の値は入れない（Q6）。 [assumption]
- `actorName` を写しで持つのは、アカウントを無効にしたり消したりしても記録が読めるようにするため。 [assumption]
- 操作の記録の並び順は `occurredAt` の新しい順。同じ時刻のときは `entryId` で決める。 [assumption]
