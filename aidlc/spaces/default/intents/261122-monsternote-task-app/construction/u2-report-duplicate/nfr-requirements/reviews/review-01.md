**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.7、tech-stack-decisions.md > 「24 時間の自動削除」の行 | `inception/domain-design/decisions.md` の ADR-009 と `inception/contract-design/contract-summary.md` の 2.1b は、24 時間たっても結び付かない写真を消す仕組みを「Reporting の定期の処理が、部品の身元の証明で `DELETE /internal/v1/species-detections/by-photos`（C8）を呼び、SpeciesDetection に判別の結果を消させる」と明確に決めている（2.1b の表の 1 行目）。ところが U2 の NFR12.7・tech-stack-decisions.md は、この定期の処理を候補として挙げたうえで明示的に選ばず（「自分で動かす定期の処理は作らない」）、DynamoDB の TTL と S3 のライフサイクルだけで消す設計にしている。ADR-009・2.1b への言及も、この決定を置き換える旨の記載もどこにもない。このままでは、Infrastructure Design・Code Generation の担当者が「C8 の DELETE の道と、それを呼ぶ定期の処理」を契約どおりに作るべきか、TTL だけで済ませてよいか判断できず、2.1b の部品の身元の証明の表（NFR4.8・NFR4.9 が根拠にしている表）も実態と合わなくなる。 | ADR-009・contract-summary 2.1b を明示的に参照し、「TTL と S3 のライフサイクルだけで足り、Reporting から SpeciesDetection への `DELETE /internal/v1/species-detections/by-photos` の呼び出しと、それを呼ぶ定期の処理は不要になった」という置き換えの決定として NFR12.7 に書くか、逆に 2.1b の呼び出しをそのまま残すなら、その呼び出しを行う定期の処理の性質（Lambda＋EventBridge Scheduler 等）と費用を NFR12.7 に書き足し、「定期の処理は作らない」という記述と矛盾しないようにする。 | New |
| R-02 | Critical | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.5、Assumptions & Open Questions の 1 行目 | NFR12.5 は「1 つの報告（送信のキー＝submissionKey）につき判別の呼び出しは 10 回まで」と、数え方の単位が確定しているかのように書かれている。しかし `functional-design/entities.md`・`functional-design/functional-spec.md`（UC9 のステップ 1「送信のキー（submissionKey）を確かめる」）によれば、submissionKey は報告の送信（UC9・POST /v1/reports）の時点で初めて使われる値であり、種類の判別（BR6.2）は全身の写真のアップロード完了時（UC8 の 1/7、送信よりずっと前）に呼ばれる。つまり判別が呼ばれる時点では、まだ submissionKey が存在しない可能性が高く、「送信のキーごとに 10 回まで」を文字どおりには数えられない。この問題は同ファイルの Assumptions 欄でも「どこに覚えるかは NFR Design で決める」と認めており、要件自身が未解決であることを自覚していながら、要件の文言では確定事項として書かれている。無料枠超過・費用の暴走を防ぐ唯一の歯止め（NFR12.5／project.md の Forbidden「無料枠を超える負荷の禁止」に関わる）が、実装可能な形で定義されていない。 | NFR12.5 の文言を「暫定（NFR Design で数え方を確定する）」であると明示するか、写真の受け付け時点ですでに存在する識別子（例えばハンターのアカウント ID と報告作成セッションの単位）を数える単位として示すなど、判別が呼ばれる時点で実在する値をもとにした上限の数え方を先に決めてから「OK」として確定させる。 | New |
| R-03 | Major | construction/u2-report-duplicate/nfr-requirements/performance-requirements.md > NFR2.7、Assumptions & Open Questions の 1 行目 | NFR2.7 は、全身の写真のアップロード完了（`POST /v1/photos/{id}/complete`）を 95% で 5 秒以内とし、その内訳に判別の 3 秒の区切り（NFR2.8）を含めている。残りの持ち時間は約 2 秒しかなく、ここに実物の確認（S3 への存在確認）・大きさ/形式の確認・DynamoDB への書き込み・API Gateway の往復に加え、U1 の NFR2.5 が求める「関数の起動の遅れ（コールドスタート）を含めて守る」という条件も乗る。Rekognition の SDK クライアントを含む Lambda のコールドスタートは、Node.js でも数百ミリ秒〜1 秒程度かかることがあり、2 秒の余裕では吸収しきれないおそれがある。U2 の性能要件は、U1 の NFR2.5（コールドスタート込みで守る）が NFR2.6〜2.11 にも及ぶかどうかを明記しておらず、Assumptions も「dev で測って届かなければ区切りを縮める」という事後対応だけで、コールドスタートを明示的に見込んでいない。 | NFR2.7 の内訳にコールドスタートの見込み（例: 0.5〜1 秒）を明記するか、NFR2.5 が NFR2.6〜2.11 にも適用されることを本文に明記したうえで、5 秒の目標が dev での実測前から「達成できる見込みがある」ことを示す根拠（関数を温めておく・判別用の関数を分離して軽くする等）を書き足す。 | New |
| R-04 | Major | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.7、reliability-requirements.md > NFR10.13・NFR11.8 | 「結び付かなかった写真と判別の結果は 24 時間で自動的に消える」という表現が、NFR12.7・NFR10.13・NFR11.8 の複数箇所でそのまま断定的に書かれている。しかし実装手段として選んだ DynamoDB の TTL は、AWS の仕様上「有効期限から最大 48 時間程度まで削除が遅れることがある」ものであり、S3 のライフサイクルルールも 1 日 1 回のバッチで動くため、実際に物が消えるのは「24 時間ちょうど」ではなく、それより数時間〜1 日以上遅れることが普通にある。機能面は BR2.14（24 時間を超えた写真は使えないという確認）で守られているため実害は小さいが、「24 時間で自動的に消える」という要件文そのものは測り方（NFR13.7「設定の確認までとする」）と食い違っており、達成できると書いてある目標が実際には保証されていない。 | 「24 時間を過ぎた写真は報告に使えなくなる（論理的な期限）」と「実際に記録・実体が消えるのは TTL／ライフサイクルの実行タイミング次第で遅れることがある（物理的な削除）」を要件の文言として分け、後者には「最大で数時間〜1 日程度の遅れがあり得る」という前提を明記する。 | New |
| R-05 | Minor | construction/u2-report-duplicate/nfr-requirements/tech-stack-decisions.md > 「種類の自動判別」の行 | `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` の「Allowed services」の表に Amazon Rekognition は載っておらず、「Disallowed services」には「有料 AI サービス（Bedrock 等）を従量課金で常時呼ぶ機能」が禁止として明記されている。tech-stack-decisions.md は Bedrock・SageMaker を退けて Rekognition を選ぶ理由（無料枠・IAM ロールで呼べる）を示しており、nfr-requirements-questions.md の Q2 で人の承認も得ているため実質的な手続きは踏まれているが、technical-environment.md 自体への追記や、同ファイルの「新しいサービスの承認を得る」手順との対応関係がどの U2 の文書にも書かれていない。 | tech-stack-decisions.md の Assumptions、または NFR Design への申し送りとして、「technical-environment.md の Allowed services に Amazon Rekognition を追記する（Q2 で承認済み）」という一文を足す。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージに指定された検証ツールなし。traceability.json の整合性は目視で確認した） | — | NFR ID の採番は U1（NFR2.1〜NFR2.5 等）と衝突しておらず、traceability.json の upstream_ids と coverage は requirements.md の NFR1〜NFR14 を一通りカバーしている。ただし上記 Critical の 2 件は、coverage の「OK」表示が実装可能性まで保証していないことを示している。 |

### Summary

U2 の NFR は、判別・重複判定・写真複数枚・24 時間削除という新規要素を丁寧に分解しているが、ADR-009／contract-summary 2.1b の「定期の処理による削除」という既に確定した inception の決定と、NFR12.7 の「TTL だけで消す」という選択が正面から食い違っており、どちらが正かを明記していない。また NFR12.5 の「送信のキーごとに 10 回まで」という判別呼び出しの上限は、判別が呼ばれる時点でまだ送信のキーが存在しないという構造上の問題を抱えたまま「OK」として確定扱いになっている。これら 2 点は実装段階で開発者がどちらの設計に従うべきか判断できない水準の矛盾であり、加えて性能目標（NFR2.7）と削除タイミング（NFR12.7 等）の達成可能性にも疑問が残るため、NOT-READY と判断する。
