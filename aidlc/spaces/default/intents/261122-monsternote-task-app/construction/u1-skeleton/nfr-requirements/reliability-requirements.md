# Reliability Requirements（信頼性の要件）— U1 `u1-skeleton`

入力: `inception/requirements-analysis/requirements.md`（NFR10・NFR11）、`inception/domain-design/decisions.md`（ADR-008 知らせ）、`inception/contract-design/contract-summary.md`（2.3 時間切れとやり直し、2.5 順番）、`construction/u1-skeleton/functional-design/rules.md`（BR2.6・BR2.7・BR3.7・BR4.1）、nfr-requirements-questions.md（Q7）。

## 1. 動いている割合

| ID | 要件 | 測り方 | 出典 |
|---|---|---|---|
| NFR10.1 | 目安: 30 日間で、API への呼び出しの 99% 以上が成功（5xx ではない）。これを下回っても試験運用は止めず、原因を調べる（紙の報告に戻れるため、厳しい目標は置かない） | API Gateway の 5xx の数と全体の数（CloudWatch のメトリクス） | NFR10、Q7、A-5 |
| NFR10.2 | 報告の送信が失敗しても、入力した内容は画面に残り、同じ送信のキーで送り直せる（1 件だけ作られる） | 単体試験・E2E | NFR10、BR2.6 |
| NFR10.3 | 保存した報告には必ず「報告が保存された」知らせが送られ、確認中の記録と一覧の行ができる。知らせを確実に届ける方法（保存と知らせの送信を同時に成り立たせる方法、再送、失敗したときの置き場）は NFR Design で決める | 結合試験（dev） | NFR10、ADR-008、BR2.7 |
| NFR10.4 | 知らせの受け手は、同じ知らせが 2 回届いても結果が変わらない（eventId で 2 回目を無視）。順番が入れ替わっても、新しい知らせだけを反映する | 単体試験 | contract-summary 2.4・2.5、BR4.1 |
| NFR10.5 | 承認の時点で確認の記録がまだないとき（知らせの遅れ）は、404 で「少し待ってからもう一度」と返し、データを壊さない | 単体試験 | BR3.7 |

## 2. 保存期間とバックアップ

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.1 | Lambda などの動作ログ（CloudWatch Logs）は 14 日で消える | NFR11、NFR12.3 |
| NFR11.2 | 報告・写真・確認の記録は試験運用が終わるまで保存する（消すのは U4 の削除の操作） | NFR11、FR10.2 |
| NFR11.3 | DynamoDB の自動のバックアップ（ポイントインタイムリカバリ）は使わない（費用がかかるため）。試験運用の規模では、消えた報告は紙に戻って補う | NFR1、A-5 |

## Assumptions & Open Questions

- DynamoDB と S3 は、AWS の仕組みとして複数の場所にデータを持つため、通常の障害ではデータは失われない前提とする。誤って消した場合の戻し方は持たない（NFR11.3）。 [assumption]
