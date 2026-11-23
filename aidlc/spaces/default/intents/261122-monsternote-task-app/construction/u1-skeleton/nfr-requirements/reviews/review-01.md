## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T09:54:26Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/security-requirements.md > 2. データの保護 > NFR5.1 | NFR5.1 は「TLS 1.2 以上」を CDK の構成の試験で確かめるとしている。しかし画面の配信は CloudFront の既定ドメイン（`*.cloudfront.net`）を使う。独自ドメインと Route 53 は technical-environment.md で禁止されている。既定の証明書では CloudFront の最小の TLS のバージョンを変えられず、TLS 1.0 以上を受け付ける。そのため、この要件は試験で確かめられず、守ることもできない。 | NFR5.1 を二つに分ける。(a) API Gateway は TLS 1.2 以上（既定の API エンドポイントで満たす）。(b) CloudFront は既定ドメインの制約により最小の TLS のバージョンを選べない。HTTP から HTTPS への転送と HTTPS のみの許可で担保し、残るリスクを受容として記録する。試験は「ビューアプロトコルが https-only または redirect-to-https」に直す。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/security-requirements.md > 1. 認証と認可 | ハンター用と依頼元用で別々の CloudFront の画面（別オリジン）から API を呼ぶ。CORS の許可の要件（許可するオリジン、メソッド、ヘッダー）がどこにもない。また、画面の応答のセキュリティヘッダー（CSP、X-Content-Type-Options など）も要件にない。 | NFR4 の系列に、CORS の許可オリジンを 2 つの CloudFront のドメインだけに限る要件を足す。セキュリティヘッダーは、足すかスコープ外と明記するかを決める。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/security-requirements.md > NFR4.3 | 役割は Cognito の証明のグループから取る。アカウントを無効にしても、すでに発行された証明は最長 1 時間通る。役割の変更も同じ遅れで反映される。この遅れが要件にも脅威の考慮にも書かれていない。 | 「無効化・役割変更の反映は最長 1 時間（証明の期限）」を受容として明記する。または、各関数が accountId の有効性を確かめる要件にする。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/observability-requirements.md > 2. 指標とアラーム (NFR10.7)、3. 監査の記録 (NFR14) | 「報告が保存された」知らせの配送の失敗（NFR10.3 の失敗したときの置き場）を知らせるアラームの要件がない。無音で確認中の記録ができない失敗が起きうる。U4 ができるまで `audit.recorded` を受ける所がなく、それまでに送った操作の記録は残らない恐れがある。 | 配送の失敗を数える指標とアラームを、NFR Design に引き継ぐ項目として明記する（既存のアラームの枠内で）。U4 より前の監査の知らせの扱い（失われてよいか）を一文で書く。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/scalability-requirements.md > 2. 費用の表 | Cognito の無料枠を「月 5 万人」としているが、現行の新規ユーザープールの無料枠はこれと異なる可能性が高い（この見積もりでは 20 人なので結論は変わらない）。DynamoDB の単価も、読み取りと書き込みで異なる。 | 無料枠の数字を最新の公開の料金表で確かめて直す。確かめられないときは「要確認」と書く（project.md の費用の確認の規則）。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/construction/u1-skeleton/nfr-requirements/reliability-requirements.md > NFR10.1 | 上位の NFR10 と仮定 A-5 は「独自の目標は設けない」。この文書は 99%/30 日の目安を置いている。人間が承認した Q7 の選択なので矛盾ではないが、上位の要件との差が明示されていない。 | NFR10.1 に「上位の NFR10 に対する追加の目安（Q7 で決定）」と書いて、出典をたどれるようにする。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json（NFR1〜NFR14 の網羅） | 全 ID に OK、NFR14 は N/A（U4 担当と理由つき） | 上位の NFR との対応は漏れがない。NFR14 の N/A は妥当。 |
| 相互参照の確認（手作業） | NFR ID・BR ID・Q1〜Q7 の参照は解決する | 壊れた参照は見つからなかった。 |

### Summary

NFR は上位の NFR1〜NFR14 を数値と確かめ方つきで網羅しており、費用・規模・信頼性の整合も取れている。Major は 1 件で、CloudFront の既定ドメインでは確かめられない「TLS 1.2 以上」の要件だけ。これは NFR Design に進む前に直しておくとよい。それ以外は Minor で、READY を妨げない。
