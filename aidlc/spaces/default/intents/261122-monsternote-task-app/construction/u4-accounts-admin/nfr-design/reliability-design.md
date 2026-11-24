# Reliability Design（信頼性の設計）— U4 `u4-accounts-admin`

入力: `construction/u4-accounts-admin/nfr-requirements/reliability-requirements.md`（NFR10.26〜NFR11.20）、logical-components.md、`construction/u4-accounts-admin/functional-design/rules.md`（BR11.2・BR11.9・BR11.11、BR12.2・BR12.4、BR13.1）、`construction/u4-accounts-admin/functional-design/entities.md`（Account・AdminCounter）。

## 1. アカウントの操作の確かさ（NFR10.26）

**アカウントの作成（BR11.2）**: `loginId` の一意性は、**Cognito 側の `AdminCreateUser` がすでに保証する**（`loginId` を Cognito のユーザー名としてそのまま使うため。performance-design.md §2 の Q3-A のとおり、Cognito 側の作成を先に行う設計により、同じ `loginId` での 2 回目の呼び出しは Cognito が `UsernameExistsException` で拒む。これを受けて `409 LOGIN_ID_TAKEN` を返し、DynamoDB 側には一切書き込まない）。DynamoDB 側で `loginId` の一意性を確認する別の仕組み（二次的なロック項目など）は作らない。新しい表は `AdminCounter`・`AuditEntry` の 2 つだけで、`Account` の形も U1 から変えない（logical-components.md・entities.md のとおり）。

> **BR11.2・entities.md の「条件にした 1 回の書き込み」との関係**: 機能設計の BR11.2 は「ID が重ならないことを条件にした 1 回の書き込みで作る」と書いており、字面だけを読むと DynamoDB 側の条件付き書き込みを指しているように見える。本設計では、この「1 回の書き込み」を **Cognito の `AdminCreateUser` 呼び出し**（`loginId` の重複を条件に拒む、ユーザー名の一意性という形の「書き込み」）として実現する。BR11.2・entities.md が定める**結果**（`loginId` は重ならない、重なれば 409 で拒む）は変わらず、**どの層がその結果を保証するか**という実現の手段をここで具体化したものであり、業務の決まりそのものを変える変更ではない。Code Generation では、この reliability-design.md の実現方法を優先し、DynamoDB 側に `loginId` を条件にした書き込みを別途実装しない。



Cognito 側が成功したあとの DynamoDB 側の書き込みは、`Account` の作成と、役割が admin のときの `AdminCounter` の増加を 1 つの `TransactWriteItems` にまとめる:

```
TransactWriteItems:
  1. Put Account(accountId, loginId, …)  （新しい accountId のため条件は不要。loginId の一意性は Cognito 側ですでに確認済み）
  2. [role=admin のときだけ] Update AdminCounter SET activeAdminCount = activeAdminCount + :one
```

**管理者の無効化・有効化（BR11.9）**:

```
無効化:
  TransactWriteItems:
    1. Update Account SET status = :disabled   ConditionExpression: "status = :active"
    2. Update AdminCounter SET activeAdminCount = activeAdminCount - :one
                                                ConditionExpression: "activeAdminCount >= :two"

有効化:
  TransactWriteItems:
    1. Update Account SET status = :active     ConditionExpression: "status = :disabled"
    2. Update AdminCounter SET activeAdminCount = activeAdminCount + :one
```

2 つの書き換えを同じトランザクションにまとめることで、「アカウントは無効になったが数は減っていない」「数だけ減って実際は有効なまま」というずれを防ぐ（BR11.9・レビュー R-02・R-10 の裏付け）。「対象が自分自身」の確認は、この条件式より前に、アプリ層の単純な比較で行う（security-design.md §2）。

**最初の管理者（BR11.11）**: スクリプトでの作成は、`AdminCounter` の行が無ければ 1 で作り（`SET activeAdminCount = if_not_exists(activeAdminCount, :zero) + :one`）、あれば単純に +1 する。1 行しかない表のため、`if_not_exists` を使えば「行がまだ無い最初の実行」と「2 人目以降」のどちらでも同じ式で安全に動く（U2・U4 で繰り返し確認してきたアトミック性の作法をここでも適用する）。

**AdminCounter のずれの数え直し（NFR10.27）**: 上の `TransactWriteItems` により通常はずれないが、万一（Code Generation 時点の不具合、手動の復旧操作など）ずれた場合に備え、管理者がアカウントの一覧（`GET /v1/admin/accounts`）を開いたときに、Accounts 関数が `role=admin AND status=active` の件数を数え直し、`AdminCounter.activeAdminCount` と異なれば上書きして直す（読み出しのついでに行う補正で、専用の監視・定期実行の処理は作らない。機能設計の決定どおり）。この数え直しは一覧の応答を遅らせない範囲（既存の一覧のクエリに数件の追加の読み出しが載る程度）で行う。

## 2. 操作の記録の確かさ（NFR10.26 の一部、BR12.2・BR12.4）

`audit.recorded` を受けた AuditLog 関数は、`eventId` を条件にした 1 回の `PutItem`（`ConditionExpression: "attribute_not_exists(eventId)"`）で `AuditEntry` を作る。同じ知らせを 2 回受けても 2 件目は `ConditionalCheckFailedException` になり、無視する（何もしない。BR12.2）。`AuditEntry` には書き換え・削除の入口を一切作らない（BR12.4。「すべて削除」の対象からも外す）。

## 3. 「すべて削除」の確かさ（NFR10.28〜NFR10.30）

各部品の削除入口は、**対象の表を読んで消すだけ**の処理であり、何も残っていなければ 0 件で成功する（BR13.1 の「もう何も無い状態で呼んでも 0 件を返して成功する」を、`BatchWriteItem` のループが「読んだ件数が 0 なら即終了」という形でそのまま満たす）。失敗したときは、performance-design のバッチ単位の処理のうち、どこまで消せたかは中途半端になりうるが、再度同じ入口を呼べば残りが消えるだけで、二重に消して壊れることはない（削除は冪等）。

5 つの入口がすべて成功で終わったあと、画面は Report と ReportListItem の件数をもう一度数える（既存の一覧の API で 0 件を確認する）。0 件でなければ、削除の最中に新しい報告が届いた可能性があるため、「削除のあとに新しい報告が届きました。もう一度削除してください」と表示し、同じ 5 つの入口をもう一度呼べるようにする（NFR10.29、BR13.1）。この再確認は AdminApp 側の処理であり、サーバー側に新しい API を作らない。

削除の実行中に知らせ（`report.saved` など）が届いた場合、遅れて届いた知らせが行を作り直すことがあるが、BR13.1 の「何度呼んでも同じ結果」により、もう一度同じ順で削除すれば解消する（NFR10.30）。

## 4. 保存期間（NFR11.19・NFR11.20）

`AuditEntry` は `RemovalPolicy: RETAIN`、TTL なし（試験運用そのものを終えるときに `cdk destroy` で環境ごと片付けて消す。BR12.4・レビュー R-06）。`Account` は「すべて削除」の対象に含めない（無効化で扱う。BR13.3・NFR11.20）。

## Assumptions & Open Questions

- `loginId` の一意性を Cognito 側だけに頼る設計は、Cognito の作成が必ず DynamoDB の書き込みより先に行われること（Q3-A）を前提にしている。将来、この順番を入れ替える変更があれば、`loginId` の一意性確認をどこで行うか（DynamoDB 側の仕組みを足すか）を改めて設計し直す必要がある。 [assumption]
