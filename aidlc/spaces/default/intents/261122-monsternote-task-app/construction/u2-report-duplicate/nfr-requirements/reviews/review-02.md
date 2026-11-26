**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.7、tech-stack-decisions.md > 「24 時間の自動削除」の行 | `inception/domain-design/decisions.md` の ADR-009 と `inception/contract-design/contract-summary.md` の 2.1b は、24 時間たっても結び付かない写真を消す仕組みを「Reporting の定期の処理が、部品の身元の証明で `DELETE /internal/v1/species-detections/by-photos`（C8）を呼び、SpeciesDetection に判別の結果を消させる」と明確に決めている（2.1b の表の 1 行目）。ところが U2 の NFR12.7・tech-stack-decisions.md は、この定期の処理を候補として挙げたうえで明示的に選ばず（「自分で動かす定期の処理は作らない」）、DynamoDB の TTL と S3 のライフサイクルだけで消す設計にしている。ADR-009・2.1b への言及も、この決定を置き換える旨の記載もどこにもない。このままでは、Infrastructure Design・Code Generation の担当者が「C8 の DELETE の道と、それを呼ぶ定期の処理」を契約どおりに作るべきか、TTL だけで済ませてよいか判断できず、2.1b の部品の身元の証明の表（NFR4.8・NFR4.9 が根拠にしている表）も実態と合わなくなる。 | ADR-009・contract-summary 2.1b を明示的に参照し、「TTL と S3 のライフサイクルだけで足り、Reporting から SpeciesDetection への `DELETE /internal/v1/species-detections/by-photos` の呼び出しと、それを呼ぶ定期の処理は不要になった」という置き換えの決定として NFR12.7 に書くか、逆に 2.1b の呼び出しをそのまま残すなら、その呼び出しを行う定期の処理の性質（Lambda＋EventBridge Scheduler 等）と費用を NFR12.7 に書き足し、「定期の処理は作らない」という記述と矛盾しないようにする。 | Resolved (reviewer) |
| R-02 | Critical | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.5、Assumptions & Open Questions の 1 行目 | NFR12.5 は「1 つの報告（送信のキー＝submissionKey）につき判別の呼び出しは 10 回まで」と、数え方の単位が確定しているかのように書かれている。しかし `functional-design/entities.md`・`functional-design/functional-spec.md`（UC9 のステップ 1「送信のキー（submissionKey）を確かめる」）によれば、submissionKey は報告の送信（UC9・POST /v1/reports）の時点で初めて使われる値であり、種類の判別（BR6.2）は全身の写真のアップロード完了時（UC8 の 1/7、送信よりずっと前）に呼ばれる。つまり判別が呼ばれる時点では、まだ submissionKey が存在しない可能性が高く、「送信のキーごとに 10 回まで」を文字どおりには数えられない。この問題は同ファイルの Assumptions 欄でも「どこに覚えるかは NFR Design で決める」と認めており、要件自身が未解決であることを自覚していながら、要件の文言では確定事項として書かれている。無料枠超過・費用の暴走を防ぐ唯一の歯止め（NFR12.5／project.md の Forbidden「無料枠を超える負荷の禁止」に関わる）が、実装可能な形で定義されていない。 | NFR12.5 の文言を「暫定（NFR Design で数え方を確定する）」であると明示するか、写真の受け付け時点ですでに存在する識別子（例えばハンターのアカウント ID と報告作成セッションの単位）を数える単位として示すなど、判別が呼ばれる時点で実在する値をもとにした上限の数え方を先に決めてから「OK」として確定させる。 | Resolved (reviewer) |
| R-03 | Major | construction/u2-report-duplicate/nfr-requirements/performance-requirements.md > NFR2.7、Assumptions & Open Questions の 1 行目 | NFR2.7 は、全身の写真のアップロード完了（`POST /v1/photos/{id}/complete`）を 95% で 5 秒以内とし、その内訳に判別の 3 秒の区切り（NFR2.8）を含めている。残りの持ち時間は約 2 秒しかなく、ここに実物の確認（S3 への存在確認）・大きさ/形式の確認・DynamoDB への書き込み・API Gateway の往復に加え、U1 の NFR2.5 が求める「関数の起動の遅れ（コールドスタート）を含めて守る」という条件も乗る。Rekognition の SDK クライアントを含む Lambda のコールドスタートは、Node.js でも数百ミリ秒〜1 秒程度かかることがあり、2 秒の余裕では吸収しきれないおそれがある。U2 の性能要件は、U1 の NFR2.5（コールドスタート込みで守る）が NFR2.6〜2.11 にも及ぶかどうかを明記しておらず、Assumptions も「dev で測って届かなければ区切りを縮める」という事後対応だけで、コールドスタートを明示的に見込んでいない。 | NFR2.7 の内訳にコールドスタートの見込み（例: 0.5〜1 秒）を明記するか、NFR2.5 が NFR2.6〜2.11 にも適用されることを本文に明記したうえで、5 秒の目標が dev での実測前から「達成できる見込みがある」ことを示す根拠（関数を温めておく・判別用の関数を分離して軽くする等）を書き足す。 | Resolved (reviewer) |
| R-04 | Major | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.7、reliability-requirements.md > NFR10.13・NFR11.8 | 「結び付かなかった写真と判別の結果は 24 時間で自動的に消える」という表現が、NFR12.7・NFR10.13・NFR11.8 の複数箇所でそのまま断定的に書かれている。しかし実装手段として選んだ DynamoDB の TTL は、AWS の仕様上「有効期限から最大 48 時間程度まで削除が遅れることがある」ものであり、S3 のライフサイクルルールも 1 日 1 回のバッチで動くため、実際に物が消えるのは「24 時間ちょうど」ではなく、それより数時間〜1 日以上遅れることが普通にある。機能面は BR2.14（24 時間を超えた写真は使えないという確認）で守られているため実害は小さいが、「24 時間で自動的に消える」という要件文そのものは測り方（NFR13.7「設定の確認までとする」）と食い違っており、達成できると書いてある目標が実際には保証されていない。 | 「24 時間を過ぎた写真は報告に使えなくなる（論理的な期限）」と「実際に記録・実体が消えるのは TTL／ライフサイクルの実行タイミング次第で遅れることがある（物理的な削除）」を要件の文言として分け、後者には「最大で数時間〜1 日程度の遅れがあり得る」という前提を明記する。 | Resolved (reviewer) |
| R-05 | Minor | construction/u2-report-duplicate/nfr-requirements/tech-stack-decisions.md > 「種類の自動判別」の行 | `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` の「Allowed services」の表に Amazon Rekognition は載っておらず、「Disallowed services」には「有料 AI サービス（Bedrock 等）を従量課金で常時呼ぶ機能」が禁止として明記されている。tech-stack-decisions.md は Bedrock・SageMaker を退けて Rekognition を選ぶ理由（無料枠・IAM ロールで呼べる）を示しており、nfr-requirements-questions.md の Q2 で人の承認も得ているため実質的な手続きは踏まれているが、technical-environment.md 自体への追記や、同ファイルの「新しいサービスの承認を得る」手順との対応関係がどの U2 の文書にも書かれていない。 | tech-stack-decisions.md の Assumptions、または NFR Design への申し送りとして、「technical-environment.md の Allowed services に Amazon Rekognition を追記する（Q2 で承認済み）」という一文を足す。 | Resolved (reviewer) |
| R-06 | Major | construction/u2-report-duplicate/nfr-requirements/security-requirements.md > 4. 脅威の考慮、「判別のサービスを大量に呼んで費用を増やす」の行 | R-02 で NFR12.5 は「1 人のハンターにつき 1 日 30 回まで」に変わったが、security-requirements.md の脅威の表はまだ「1 つの報告につき 10 回までの上限（Q2・NFR12.5）」という直し前の数え方のまま残っている。NFR12.5 を出典として指しているのに、その NFR12.5 の実際の内容と数え方（単位・回数とも）が食い違っており、この表だけを読むと誤った上限（報告単位・10 回）で試験を書いてしまうおそれがある。 | security-requirements.md の該当行を「1 人のハンターにつき 1 日 30 回までの上限（Q2・NFR12.5）」に直し、NFR12.5 の現在の文言と一致させる。 | New |
| R-07 | Minor | construction/u2-report-duplicate/nfr-requirements/scalability-requirements.md > NFR12.5、Assumptions & Open Questions の 1 行目 | 「ハンターのアカウントと日付の組」で数える設計になったが、ここでの「日付」がどのタイムゾーンの 0 時を境にするか（UTC か JST か）が書かれていない。同じ文書内の BR8.3（重複の判定の「種類＋捕獲日」の索引）は明示的に UTC の日で区切っており、ここだけ基準がない状態で NFR Design に渡ると、日をまたぐ時間帯（JST 9 時台）での上限のリセット時刻が設計者ごとにぶれるおそれがある。また、アカウント×日付ごとに数える記録を複数の写真アップロードが同時に増やしたときの排他制御（条件付き書き込みなど。1 加算の競合で 31 回目以降もすり抜ける可能性）にも触れていない。 | NFR12.5 または Assumptions に「日付は UTC（BR8.3 の speciesDay と同じ基準）」のように基準を明記し、数える記録の増分は条件付き書き込み（アトミックなインクリメント）で行うことも一文加える。 | New |
| R-08 | Minor | construction/u2-report-duplicate/nfr-requirements/tech-stack-decisions.md > 「2. 約束（contract-summary）・ADR との違い」冒頭の注記 | D-1 は「約束の文書（`contracts/openapi.yaml`）は Code Generation で更新する」としており、`inception/contract-design/contract-summary.md` 自体（2.1b の表・C8 の OpenAPI の記述）は NFR Requirements の時点では直されない。Infrastructure Design は通常、Code Generation より前に本文で IAM の権限や内部の道の要否を決める段階であり、もし D-1 を読み落として contract-summary.md の 2.1b をそのまま使うと、不要になった内部の削除の道と部品の身元の証明の権限を作ってしまう可能性がある。 | Infrastructure Design への申し送りとして、D-1 の決定（内部の削除の道は作らない）を明示的に参照するよう、NFR Requirements のどこか（例えば本ファイルの冒頭の入力一覧）に一文を加える。 | New |

> R-01 Reviewer note: tech-stack-decisions.md に「2. 約束（contract-summary）・ADR との違い」の D-1 行が追加され、ADR-009・C8 `DELETE /internal/v1/species-detections/by-photos`・2.1b の部品の身元の証明の許可を名指しで挙げ、「部品ごとに自分のデータを消す（内部の削除の道は作らない）」という置き換えの決定を、ADR-009 自身の「仕組みは Functional Design・NFR Design で決める」という文に根拠づけて明記している。NFR12.7 の出典にも ADR-009 が入った。C17（U4 の admin delete）への影響なしの注記もある。

> R-02 Reviewer note: NFR12.5 が「1 人のハンターにつき 1 日 30 回」（ハンターのアカウントと日付の組で数え、翌日に戻る）に変わり、entities.md・functional-spec.md の示す「submissionKey は送信（UC9）まで存在しない」という制約と矛盾しなくなった。Assumptions に、submissionKey を選ばなかった理由（判別は送信のキーがまだ無い写真のアップロード時点で動くため）が明記されている。NFR11.12（observability-requirements.md）も `errorCode=DETECTION_LIMIT_REACHED` の記録を「1 人 1 日 30 回」に合わせて更新済み。

> R-03 Reviewer note: NFR2.7 が 6 秒に引き上げられ、「アップロードの完了の 6 秒の内訳」表（起動の遅れ 1.5 秒・実物の確認 0.3 秒・判別 3 秒・書き込み 1 秒＝合計約 5.8 秒）で、U1 の NFR2.5（コールドスタートを含めて目標を守る）を明示的に満たす形になった。Assumptions もこの内訳を踏まえた記述に直っている。

> R-04 Reviewer note: NFR12.7・NFR10.13・NFR11.8 のすべてで、「24 時間を過ぎたあと AWS の仕組みが順に消す」「きっかり 24 時間では消えない（DynamoDB の TTL は最大 48 時間以内、S3 のライフサイクルは 1 日 1 回のため、最大で 1〜2 日ほど遅れる）」と明記され、BR2.14 の 24 時間以内の確認が実際の削除の遅れを補っていることも書かれている。測り方（NFR13.7）との食い違いは解消した。

> R-05 Reviewer note: tech-stack-decisions.md の「種類の自動判別」の行に、Rekognition が `technical-environment.md` の「使ってよいサービス」表に載っていないこと、同文書の「新しいサービスの承認の手順」に従って承認を得たこと（機能設計の Q6、NFR の Q2 で費用を示した）が明記された。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージに指定された検証ツールなし） | — | R-01〜R-05 の直しを対象ファイルに対して目視で確認した。`by-photos` という文字列は `inception/contract-design/` 配下にのみ残っており、U1・U3・U4 の construction 配下のどの文書もこの内部の道を前提にしていないことを確認した（grep）。U2 の entities.md には、新しい「1 人 1 日 30 回」の数え方に対応する記録（表）がまだ定義されておらず、NFR Design 行きの assumption としてのみ存在する。 |

### Summary

5 件の指摘はいずれも直っており、Critical だった ADR-009／C8 の矛盾と submissionKey の数え方の矛盾は、根拠（ADR-009 自身の文言、UC9 と BR6.2 のタイミングの違い）を示した形で解消されている。性能目標（NFR2.7）と削除タイミング（NFR12.7 等）の達成可能性の指摘も、具体的な内訳と限界の明記で解消した。残るのは、security-requirements.md の脅威表に直し前の「10 回」が残っている 1 件（Major、修正は 1 行の書き換えで足りる）と、新しい日次カウンタの時間帯・排他制御・contract-summary.md への伝達という 2 件の Minor な詰めの甘さのみであり、Critical はなく Major も 1 件にとどまるため READY と判断する。
