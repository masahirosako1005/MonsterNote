# Unit of Work Story Map（ストーリーと Unit の対応）— MonsterNote

入力: unit-of-work.md、`inception/user-stories/stories.md`（stories。US1.1〜US7.2）、`inception/domain-design/components.md`（components）・`decisions.md`（decisions）、`inception/requirements-analysis/requirements.md`（requirements）。

## 1. 対応表

| Story | Unit | Directory | 補足 |
|---|---|---|---|
| US1.1 | U1 | u1-skeleton | 🦴 |
| US1.2 | U4 | u4-accounts-admin | |
| US1.3 | U4 | u4-accounts-admin | |
| US1.4 | U4 | u4-accounts-admin | |
| US1.5 | U4 | u4-accounts-admin | |
| US2.1 | U1 | u1-skeleton | 🦴 |
| US2.2 | U2 | u2-report-duplicate | |
| US2.3 | U2 | u2-report-duplicate | |
| US2.4 | U2 | u2-report-duplicate | |
| US2.5 | U2 | u2-report-duplicate | |
| US2.6 | U2 | u2-report-duplicate | |
| US2.7 | U2 | u2-report-duplicate | |
| US2.8 | U2 | u2-report-duplicate | |
| US2.9 | U2 | u2-report-duplicate | |
| US2.10 | U2 | u2-report-duplicate | |
| US2.11 | U2 | u2-report-duplicate | |
| US3.1 | U2 | u2-report-duplicate | |
| US3.2 | U2 | u2-report-duplicate | |
| US3.3 | U2 | u2-report-duplicate | |
| US4.1 | U1; U3 | u1-skeleton; u3-review-list | 🦴 U1 は一覧の最小形（全件・新しい順・50 件）。U3 は絞り込み（AC4.1.2） |
| US4.2 | U1 | u1-skeleton | 🦴 重複の見比べ（AC4.2.2）は、U2 の疑いの知らせが届けば表示される |
| US4.3 | U1 | u1-skeleton | 🦴 |
| US4.4 | U3 | u3-review-list | |
| US4.5 | U3 | u3-review-list | |
| US4.6 | U3 | u3-review-list | |
| US4.7 | U3 | u3-review-list | |
| US5.1 | U1 | u1-skeleton | 🦴 |
| US5.2 | U3 | u3-review-list | |
| US5.3 | U3 | u3-review-list | |
| US6.1 | U4 | u4-accounts-admin | |
| US6.2 | U4 | u4-accounts-admin | |
| US6.3 | U4 | u4-accounts-admin | |
| US6.4 | U4 | u4-accounts-admin | 基準と対象地域の裏側は U2 の Settings を使う |
| US6.5 | U4 | u4-accounts-admin | 各部品の削除の入口を U4 で加える |
| US6.6 | U4 | u4-accounts-admin | |
| US7.1 | U2 | u2-report-duplicate | Should |
| US7.2 | U2 | u2-report-duplicate | Should |

## 2. 複数の Unit にまたがるもの

| 内容 | Unit | 扱い |
|---|---|---|
| US4.1 の一覧 | U1・U3 | U1 で最小の一覧、U3 で絞り込みと印を足す |
| ログインの証明の確認（NFR4、ADR-007・ADR-011） | U1 で共通の処理を作り、すべての Unit が使う | |
| 操作の記録（NFR14） | 各 Unit の部品が知らせを送り、U4 の AuditLog が記録する | |
| 試験運用の終わりの削除（FR10.2） | U4 が各部品に削除の入口を加える | |
| アクセシビリティ（NFR7）・デザイン（NFR8） | 全 Unit の画面が UiKit を使う | |

## 3. 各 Unit の中の依存（作る順の目安）

ストーリーの間に依存の理由があるものだけを書く。これは目安で、実際の作る順は Delivery Planning で決め直す（レビューの R-04）。

| Unit | 依存（前 → 後） | 理由 |
|---|---|---|
| U1 | AWS の土台と証明の確認 → US1.1 → US2.1 → US4.1・US4.2・US5.1 → US4.3 | ログインがないと報告できない。報告がないと一覧・詳細に出ない。詳細がないと承認できない |
| U2 | US2.2 → US2.3・US2.4 → US2.5 | 写真の受け付けがないと、日時・場所の読み取りと手入力、その確認ができない |
| U2 | US2.2 → US2.6 | 全身の写真がないと種類を判別できない |
| U2 | US2.6 → US2.7 | 種類でクマを選んだときだけ胸の写真が出る |
| U2 | US2.10 → US3.1 → US3.2、US3.1 → US3.3 | 送信の流れに重複の判定を加え、その結果で知らせる・再判定する |
| U2 | US3.1 → US7.1・US7.2 | Should の重複の判定は、重複の疑いの扱いを使う |
| U3 | US4.4 → US4.5 | 却下がないと却下の取り消しを試せない |
| U3 | US4.4 → US5.2 | 却下の理由がないとハンターに表示できない |
| U4 | US6.1 → US6.2・US6.3 | アカウントの作成がないと、再設定・無効化を試せない |
| U4 | US6.1 → US1.2〜US1.5 | 画面で作ったアカウントで初回の手続きを試す |

依存の理由がないストーリー（例: U2 の US2.8・US2.9、U3 の US4.6・US4.7、U4 の US6.4・US6.5・US6.6）は、どの順でも作れる。

## 4. 抜けの確認

| 確認 | 結果 |
|---|---|
| stories の 37 個のストーリーがすべて、どれかの Unit に割り当てられている | ✅ 37 / 37 |
| すべての Unit にストーリーがある | ✅ U1: 6（US4.1 を含む）、U2: 15、U3: 7（US4.1 を含む）、U4: 10 |

## Assumptions & Open Questions

None.
