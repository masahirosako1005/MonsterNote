# Reliability Design（信頼性の設計）— U3 `u3-review-list`

入力: `construction/u3-review-list/nfr-requirements/reliability-requirements.md`（NFR10.21〜NFR10.23、NFR11.14）、logical-components.md、`construction/u3-review-list/functional-design/rules.md`（BR3.3・BR3.9・BR3.10・BR3.13、BR4.6）、`construction/u1-skeleton/nfr-design/reliability-design.md`（U1 の設計。知らせの届け方をここで引き継ぐ）。

## 1. 同時の操作の確かさ（NFR10.21）

承認・却下・取り消しは、すべて**単一の `UpdateItem` の条件式**で行う（読んでから書く形にしない。このプロジェクトで「数えてから書く」形の誤りが複数回見つかった経緯があるため、設計の時点で具体の式を決めておく）。

**承認・却下（BR3.3）**:

```
UpdateExpression: "SET status = :newStatus, reason = :reason, reasonText = :reasonText,
                    decidedByAccountId = :acct, decidedByName = :name,
                    decidedAt = :now, undoUntil = :undo, lastEventAt = :now"
ConditionExpression: "status = :checking"
```

条件に合わなければ `ConditionalCheckFailedException` を受け、その場で記録を読み直して `decidedByName`・`status` を 409 の応答に入れる（BR3.3）。`ReviewDecision` の行は `report.saved` の時点ですでに作られている前提（U1 の BR3.1「`report.saved` の知らせで status=checking の記録を作る」）のため、U2・U4 のカウンタのような「行がまだない」場合のアトミック性（`if_not_exists`）は不要。確認の記録がまだない場合（BR3.7）は、この条件付き書き換え自体の前段の確認で 404 REVIEW_NOT_READY として拒む。

**取り消し（BR3.9）**:

```
UpdateExpression: "SET status = :checking, lastEventAt = :now
                    REMOVE reason, reasonText, decidedByAccountId, decidedByName, decidedAt, undoUntil"
ConditionExpression: "status <> :checking AND decidedByAccountId = :acct AND undoUntil >= :now"
```

3 つの条件（確認中でないこと・本人であること・期限内であること）を 1 つの `ConditionExpression` にまとめる（BR3.9 の「読んで判断するのではなく条件にした 1 回の書き換え」をそのまま式にする）。条件に合わなければ、その場で記録を読み直し、どの条件が破れたかを BR3.9 の順（確認中に戻っている → 本人でない → 期限切れ）で判定して応答を決める。

## 2. 書き換えが成功しなかったときの知らせ（NFR10.22）

`ConditionalCheckFailedException` を受けた経路では `review.status-changed` を送らない。知らせの送信コードは、条件付き書き換えが成功した経路（例外を受けなかった経路）にだけ置き、エラーハンドラの中からは呼ばない（1 回の状態の変化につき知らせが 1 回になることを、コードの構造そのもので保証する）。

**取り消しの知らせの届け方（NFR2.14 との整合）**: 承認・却下は U1 と同じく、EventBridge への送信を最大 3 回まで（間隔 0.1・0.2 秒）やり直してから応答する（performance-design.md §1）。取り消しだけは、NFR2.14 の 2 秒の目標を守るため、**送信を 1 回だけ試し、結果を待たずに応答する**。送信が失敗した場合は `eventSent=false` のまま応答を返し、ログに `EVENT_PUBLISH_FAILED` を記録して、本来の操作（取り消し自体）は止めない（U1 の `audit.recorded` の送信失敗時の扱いと同じ、受け入れたリスク）。

この送信の失敗が影響する範囲は、詳細（`GET /v1/reviews/{id}`、`ReviewDecision` を直接読む）と一覧（`GET /v1/catalog/reports`・`my-reports`、`ReportListItem` を `review.status-changed` の知らせだけで更新する。BR4.1）とで異なる:

- **詳細**: `ReviewDecision` を直接読むため、知らせの送受信にかかわらず常に正しい状態（`status=checking`）を返す。取り消しを行った本人の画面は、応答（200）を受けてその場で状態を出し直すため（BR3.9）、知らせを待たない。
- **一覧**: `ReportListItem` の `status` は知らせで更新する作りのため、取り消しの知らせが（1 回限りの送信の失敗で）届かなかった場合、その行だけ一覧上は古い状態（`approved`／`rejected`）のまま残り続ける**可能性がある**（承認・却下のときより、やり直しの回数が少ない分、この可能性は高い）。この報告についてその後なんらかの別の状態変化（再度の承認・却下など）が起きない限り、自然には直らない。

この残る可能性は、**受け入れたリスクとする**（取り消し自体は 10 秒の猶予内の操作で頻度が低く、EventBridge の `PutEvents` 呼び出し自体の失敗率も低いため、両者が重なる確率はさらに低い。試験運用の規模〈月 50 件未満の報告〉では実害が出る可能性は小さいと見込む）。詳細の画面は常に正しい状態を示すため、一覧の表示に食い違いを感じた利用者は詳細を開けば正しい状態を確認できる。これ以上の自動的な修復（定期的な整合性チェックなど）は、試験運用の規模では作らない。

## 3. 知らせの順番（NFR10.23、BR4.6）

U1 の `report.saved`／`review.status-changed` の組み立て方（`pending`→`listed` の状態機械、`processedEventIds` で二重処理を防ぐ）を `duplicate.suspected` にもそのまま使う。U3 で新しい組み立て方は作らない。

## 4. 保存期間（NFR11.14）

却下の理由・取り消しの記録は `ReviewDecision` の一部であり、U1 の `RemovalPolicy: RETAIN`・TTL なしの方針をそのまま引き継ぐ（報告と同じく試験運用が終わるまで保存）。

## Assumptions & Open Questions

- 承認・却下・取り消しの `UpdateExpression` の具体の属性名は、entities.md の項目名のとおり。Code Generation で DynamoDB のドキュメントクライアントの型に合わせて調整する余地はあるが、ConditionExpression の論理（条件の組み合わせ）はここで決めたとおりに実装する。 [assumption]
