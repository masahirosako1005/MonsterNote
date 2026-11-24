# NFR Requirements — 質問（U4 `u4-accounts-admin`: アカウントの手続きと管理者の画面）

前提: `construction/u4-accounts-admin/functional-design/`（entities・rules・functional-spec・frontend-components）、`inception/requirements-analysis/requirements.md`（NFR1〜NFR14）、`inception/contract-design/contract-summary.md`（C1・C6・C7・C15・C17）、`construction/u1-skeleton/nfr-requirements/`・`construction/u2-report-duplicate/nfr-requirements/`・`construction/u3-review-list/nfr-requirements/`（これまでに決めた NFR と技術の選択）。

U4 は最後の Unit です。新しい AWS のサービスは使いません。新しく出てくるのは、**管理者の画面の権限**、**仮のパスワードの扱い**、**試験運用の終わりの削除**、**操作の記録（AuditLog）**です。

各質問の `[Answer]:` に記号を書いてください。

## Q1. [アーキテクト] 管理者のログインの失敗が続いたときの扱いを、U1 より厳しくしますか？

U1 では「ログインの失敗が続いたときは、認証のサービスの標準の保護（一時的な締め出し）に任せる」（NFR4.5）と決めました。管理者のアカウントは、乗っ取られるとすべてのデータに触れるため、ハンター・依頼元より重みがあります。

A. **管理者も含めて、U1 の標準の保護のままにする**（試験運用の規模・数人の利用者のため、追加の仕組みは不要）
B. 管理者のアカウントだけ、失敗の回数が少ない段階で締め出す設定にする（追加の設定が要る）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q2. [アーキテクト] 「すべて削除」を実行できる人を、管理者の中でも絞りますか？

U4 では管理者が複数人いる可能性があります（画面から作れるため）。「すべて削除」は取り返しのつかない操作です。

A. **管理者なら誰でも実行できる**（役割はすでに admin の 1 種類だけで、試験運用の規模では十分。これ以上役割を増やすと複雑になる）
B. 「すべて削除」だけ別の強い権限（スーパー管理者）を設ける
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q3. [アーキテクト] 有効な管理者の数を持つ記録（AdminCounter）の整合性を、どう見張りますか？

機能設計のレビューで、この記録とアカウントの実際の数がずれる可能性（Minor、R-10）が残っています。「アカウントの一覧を開いたときに数え直す」と機能設計では決めましたが、NFR としてどの程度の確からしさを求めるか決めます。

A. **数え直しの処理を NFR の目標にはしない**（機能設計の決定どおり、画面を開いたときのついでの処理とする。独自の指標やアラームは作らない）
B. ずれを検出したら必ずログに警告を残す（監視の対象にする）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q4. [アーキテクト] 操作の記録（AuditLog）の読み出しの応答時間を、どう決めますか？

U1 で一覧・詳細は 3 秒以内と決めました。操作の記録も同じ一覧の形（50 件・ページ分け）です。

A. **同じ 3 秒以内にする**（U1 の一覧と同じ作り、件数の規模も近い）
B. 操作の記録は急いで見るものではないため、5 秒以内にゆるめる
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Q5. [アーキテクト] U4 で新しく見張るものを、増やしますか？

U1〜U3 でアラームは 2 つのままにしました。U4 ではアカウントの操作・削除・設定の変更が増えます。

A. **アラームは増やさず、ログに記録して必要なときに見る**（アカウントの作成・無効化、削除の実行、管理者の無効化が拒まれた回数）
B. 「すべて削除」が実行されたときのアラームを 1 つ足す（取り返しのつかない操作のため、気づけるようにする）
C. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
