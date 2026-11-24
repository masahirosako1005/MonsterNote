# Observability Requirements（監視の要件）— U2 `u2-report-duplicate`

入力: `construction/u1-skeleton/nfr-requirements/observability-requirements.md`（U1 の NFR10.6〜NFR10.8・NFR11.4〜NFR11.6。U2 はこれを引き継ぐ）、performance-requirements.md・reliability-requirements.md・security-requirements.md（U2 の分）、`inception/requirements-analysis/requirements.md`（NFR5・NFR10・NFR11・NFR14）、nfr-requirements-questions.md（Q5）、project.md（ログ 14 日以内）。

## 1. ログ（U2 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR11.9 | 判別を呼ぶたびに記録する: 写真の ID、結果（判別できた・できなかった）、確からしさ、できなかった理由（確からしさ不足・動物なし・サービスの失敗・時間切れ）、かかった時間。**生のラベルと写真の保存場所のキーは出さない** | Q5、NFR5.10 |
| NFR11.10 | 重複の判定のたびに記録する: 段（送信の前・保存のあと）、読んだ件数、当たった件数、かかった時間、上限（500 件）に当たったかどうか。**緯度・経度は出さない** | Q5、NFR5.10 |
| NFR11.11 | 送信の前の重複の問い合わせが失敗・時間切れになったときは、`errorCode=DUPLICATE_CHECK_FAILED` として記録する（送信は止めない） | Q3・Q5、NFR10.10 |
| NFR11.12 | 判別の呼び出しの上限（1 人 1 日 30 回）に当たったときは、`errorCode=DETECTION_LIMIT_REACHED` として記録する（どのハンターかは accountId で示す） | Q2・Q5、NFR12.5、レビュー R-02 |
| NFR11.13 | 写真のアップロードの失敗（形式・大きさ・期限切れ）は、理由の区別が付く形で記録する。写真の中身と保存場所のキーは出さない | Q5、NFR5.10 |

## 2. 指標とアラーム（U2 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR10.18 | **アラームは U1 の 2 つ（API の 5xx、関数のエラー）のままにし、U2 で増やさない。** 判別の失敗・重複の判定の打ち切りは、ログを必要なときに見て確かめる（無料枠のアラーム 10 個を使い切らないため） | Q5 |
| NFR10.19 | 必要なときに見る値（アラームは作らない）: 判別の失敗の割合、判別の時間切れの回数、重複の判定で読んだ件数、上限に当たった回数、重複の問い合わせの失敗の回数。CloudWatch Logs Insights で、ログから数える | Q5、NFR10.6 |
| NFR10.20 | 判別と重複の判定の関数も、U1 と同じ関数のエラーのアラーム（5 分間で 3 回以上）の対象に入る（関数の合計で見ているため、設定を足さなくてよい） | Q5、U1 の NFR10.7 |

## 3. 監査の記録（U2 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR14.1 | U2 の部品（Reporting・SpeciesDetection・DuplicateDetection）は、操作の知らせ（`audit.recorded`）を送る。受け手（AuditLog）は U4 で作るため、U2 の時点では記録されない（送っても受け手がなくても動く） | NFR14、unit-of-work |
| NFR14.2 | U2 が送る知らせ: 報告の送信（`report.submitted`）、重複の疑いを付けたこと（`duplicate.suspected`）。判別そのものは記録に残さない（回数が多く、NFR14 の目的に要らない） | NFR14、components |

## Assumptions & Open Questions

- NFR10.19 の値をログから数えるのは、問い合わせがあったときや、費用を確かめるときだけ。常時の集計（独自のメトリクス）は作らない（費用がかかるため）。 [assumption]
- 判別の時間切れが続くようなら、判別の区切り（3 秒）を見直す。見直しの判断は、ログから数えた割合で行う。 [assumption]
- U4 で AuditLog の受け手ができたとき、U2 が実際に `audit.recorded` を送っているかを確かめる（U1 では「計画のステップにないため送っていない」と記録が残っている）。 [assumption]
