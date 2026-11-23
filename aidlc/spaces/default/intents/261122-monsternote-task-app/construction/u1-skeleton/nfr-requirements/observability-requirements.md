# Observability Requirements（監視の要件）— U1 `u1-skeleton`

入力: `inception/requirements-analysis/requirements.md`（NFR5・NFR10・NFR11・NFR14）、reliability-requirements.md（NFR10.1）、security-requirements.md（NFR5.5）、nfr-requirements-questions.md（Q6・Q7）、project.md（ログ 14 日以内）。

## 1. ログ

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.4 | 各関数は、1 つのリクエスト・1 つの知らせごとに、JSON の形のログを書く。項目: 時刻、関数の名前、リクエストの ID（API Gateway の ID）、道（route）、状態番号、かかった時間、エラーの code。知らせの処理では eventId と type | NFR11、Q6 |
| NFR11.5 | ログに氏名・位置・従事者番号・証明・写真の URL を出さない（NFR5.5）。利用者は accountId だけで示す | NFR5、Q6 |
| NFR11.6 | ログの保存期間は 14 日（NFR12.3） | NFR11、project.md |

## 2. 指標とアラーム

| ID | 要件 | 出典 |
|---|---|---|
| NFR10.6 | 見る指標（SLI）: API Gateway の 5xx の割合、Latency の p95、Lambda のエラーの数。CloudWatch の標準のメトリクスを使う（追加の費用のかかる独自のメトリクスは作らない） | NFR10、Q6 |
| NFR10.7 | アラーム 1: 5 分間で API の 5xx の割合が 5% を超えたら（かつ呼び出しが 5 回以上）、メール（SNS）で知らせる。アラーム 2: 5 分間で Lambda のエラーが 3 回以上なら、メールで知らせる。どちらも NFR10.1 の目安（99%）を割る前に気づくための値 | NFR10、Q7、operation.md |
| NFR10.8 | 処理の追跡（X-Ray）は使わない。原因はログのリクエストの ID で追う | Q6 |

## 3. 監査の記録

| ID | 要件 | 出典 |
|---|---|---|
| NFR14 | 操作の記録（AuditLog）は U4 で作る。U1 の部品は、操作の知らせ（`audit.recorded`）を送るところまで（受け手がなくても動く） | NFR14、unit-of-work |

## Assumptions & Open Questions

- アラームのメールの宛先は、開発者のメールアドレスを CDK のデプロイのときに渡す（リポジトリには書かない）。 [assumption]
