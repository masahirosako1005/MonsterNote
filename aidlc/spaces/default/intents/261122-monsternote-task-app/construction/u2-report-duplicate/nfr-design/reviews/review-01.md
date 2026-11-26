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
| R-01 | Critical | construction/u2-report-duplicate/nfr-design/performance-design.md > 「2. 送信の時間の予算」の表と結論（関数の時間切れを8秒から10秒へ） | 同じ送信経路の最悪時間を、すでに READY 済みの `nfr-requirements/performance-requirements.md`「送信の10秒（NFR2.2）の内訳」は **約8秒**（送信キー確認0.1秒＋C10確認2秒＋写真確認0.5秒＋日時・場所確認2秒＋重複問い合わせ2秒＋保存・知らせ1秒）と計算し、「10秒の予算に収まる」と明記して関数の時間切れの変更を示唆していない。ところが本書は「U1の予算（送信キー・確認・保存・知らせ）約5.8秒」に日時・場所確認2秒と重複問い合わせ2秒を単純加算して **9.8秒** とし、同じ処理のはずの「報告できるハンターかの確認（C10）」と「写真の確認（2〜3枚）」の内訳を上流と突き合わせずに別の内訳（U1のreliability-designの合算値をそのまま再利用）を使っている。その結果、上流が「変更不要」と結論した同じ指標について、本書はすでに本番稼働中の関数の時間切れを8秒から10秒へ引き上げるという、U1に影響するインフラ変更を導いている。さらに9.8秒という数字自体、ユーザー向けの応答時間の目標（NFR2.2、10秒）に対してわずか0.2秒の余裕しかなく、API Gateway・ネットワーク・関数自身のJSON処理やログ出力などの時間がまったく含まれていない。どちらが正しい予算なのかを上流のnfr-requirementsと突き合わせて説明し、内訳の二重計上（C10・写真確認・保存知らせの扱いの食い違い）を解消したうえで、時間切れを変更するかどうかを決め直す必要がある。 | performance-design.md の送信の時間の予算を、nfr-requirements/performance-requirements.md の「送信の10秒の内訳」と同じ処理単位・同じ内訳で再計算し、両者の数字が一致する（または食い違いの理由を明記する）ようにする。そのうえで、関数の時間切れを本当に8秒から10秒へ変える必要があるか、変えた場合にNFR2.2（送信10秒）に対する余裕が確保できるかを示し直す。U1にすでにデプロイ済みの時間切れ値を変える影響（後述の別の指摘も参照）も合わせて評価する。 | New |
| R-02 | Major | construction/u2-report-duplicate/nfr-design/scalability-design.md > 「1. 判別の呼び出し回数の上限（NFR12.5、Q2）」のシーケンス図と説明文 | `DetectionRateLimit` の行を「callCount を1増やす。条件: callCount < 30 または行がない」とする単一の UpdateItem で数える設計だが、行が存在しない（その日最初の呼び出し）場合に、同じ書き込みの中で `callCount` を安全に 0 から 1 にする仕組み（`if_not_exists(callCount, :zero) + :one` のような更新式）を使うことが明記されていない。条件式だけを「行がない」を許す形にしても、更新式が存在しない属性を直接参照していれば DynamoDB は検証エラーになり得る。U2・U3・U4 で確立したはずの「条件にした1回の書き換え」（nfr-design-questions.md Q2 の選択肢Aの根拠）と同じ失敗パターンを、このプロジェクトの `AdminCounter` がまさに3回に渡って踏んだ経緯（レビュー履歴）がある以上、同じ轍を踏まないよう、更新式の具体の形（`if_not_exists` を使った1回のアトミックな書き込みであること）を設計の時点で明記すべきで、Code Generation の裁量に委ねるべきではない。 | DetectionRateLimit の UpdateItem の更新式を、行が存在しない場合も含めて単一のアトミックな書き込みで安全に動く具体の式（例: `SET callCount = if_not_exists(callCount, :zero) + :one` ＋ 条件式 `callCount < :cap OR attribute_not_exists(callCount)`）として明記する。 | New |
| R-03 | Major | construction/u2-report-duplicate/nfr-design/reliability-design.md > 「3. 写真のアップロードの確実さ」NFR10.14 の記述 | 報告の保存と写真への `reportId` 書き込みのトランザクションで、各写真の書き込みに付ける条件を「`expiresAt` が今より先であること（まだ消えていない）」という**時刻の比較**として定義している。しかし、同じ内容を定めたU2機能設計（すでに3回のアドバーサリアルレビューを経て確定済み）のBR2.13・BR2.14・entities.md（Photo.expiresAtの注記）は、この条件を「その写真がまだあること」という**存在の確認**（attribute_exists 相当）として明確に区別して定義しており、時刻の比較ではない。U2でsettings読み出し・重複問い合わせという最大4秒の処理が送信経路に新たに挟まることで、BR2.14の入口での「24時間以内」確認からこのトランザクション実行までの間隔がU1より広がっており、入口チェックを通過した直後の境界ぎりぎりの写真が、ここで時刻比較の条件に引っかかって**トランザクション全体が失敗する**（報告そのものが保存されない）ケースが生まれ得る。これは機能設計がBR2.14で明示的に想定していなかった新しい失敗経路であり、機能設計が意図した「存在確認」による保護とは異なる、より厳しい（false-positiveを生みうる）条件になっている。 | reliability-design.md の該当条件を、機能設計（BR2.13・BR2.14）が定めた「その写真の記録がまだ存在すること」という存在確認の条件に合わせて書き直す。時刻比較を使うのであれば、U2で増えた処理時間の分だけBR2.14の入口チェックとの整合性（境界付近の報告が不当に拒否されないこと）を別途示す。 | New |
| R-04 | Major | construction/u2-report-duplicate/nfr-design/logical-components.md > 「2. 構成図（U1からの差分）」の mermaid 図（`FR --> ST`・`FD --> ST` の辺） | 構成図は Reporting 関数（FR）と DuplicateDetection 関数（FD）が `L5 Setting の表（ST）` に**直接**矢印でつながっており、Settings という論理的な部品（関数）を経由せずにデータへ到達するように描かれている。しかし同じ文書の表1「構成要素の一覧」自体はSettingsを独立した部品として挙げており、U1の「分け方の考え方」（部品ごとに関数と表を分け、関数のIAMの権限は自分の表だけに絞ることで、他部品のデータに権限の誤りが及ばないようにする）という原則をU2でも引き継ぐとしている。さらにsecurity-design.md「2. 設定の読み出しの認可（NFR4.8）」とfunctional-design/rules.mdのBR9.1は、設定の読み出しに認可判定（利用者の証明／部品の身元の証明の確認）が必要であり、その判定ロジックはSettings部品（`GET /internal/v1/settings`のAPI境界）の内側にあることを前提にしている。構成図の通りReportingやDuplicateDetectionの関数がSetting表に直接アクセスできるIAM権限を持つなら、BR9.1・NFR4.8が定める認可ロジックはそもそも実行されず、丸ごと迂回されてしまう。これは本書の他の節（表1・security-design.md・BR9.1）と構成図そのものが矛盾しており、開発者がこの図のとおりにIAM権限を実装すれば認可の抜け穴ができる。 | 構成図の `FR --> ST`・`FD --> ST` の辺を、Settings 関数（API境界）を経由する呼び出しとして描き直す（例: `FR --> FSET["L4 Settings 関数"] --> ST`）。あわせて、Reporting・DuplicateDetectionのIAMロールが Setting の DynamoDB 表へ直接のアクセス権限を持たないことを明記する。 | New |
| R-05 | Minor | construction/u2-report-duplicate/nfr-design/performance-design.md > 「2. 送信の時間の予算」およびlogical-components.mdの「関数（Lambda、部品ごと）」の前提 | U1のlogical-components.mdは「関数（Lambda、部品ごと）」として、Reporting部品の複数のAPI（写真の受け付け、アップロードの完了、報告の送信など）を**単一のLambda関数**が受けるという前提に立っている（「部品ごとに関数と表を分ける」であって、ルートごとではない）。本書はこの前提を踏まえずに「送信を受け付ける関数の時間切れ」だけを10秒に引き上げると述べているが、同じLambda関数が担うほかのルート（写真の受け付け、アップロードの完了など、すでにU1として本番稼働中の経路を含む）の時間切れも同時に10秒へ変わる可能性が高い。Assumptions欄は「CDKの設定を直す必要がある」とだけ記し、この影響範囲（ほかの既存ルートへの波及）を検討した形跡がない。 | Reportingの関数が複数ルートを1つのLambdaで受けているかどうかを明記し、受けている場合は時間切れの変更がほかのルート（アップロードの完了など、U1ですでにデプロイ済みの経路）に与える影響（コスト・同時実行枠の専有時間の増加など）を評価したうえで記載する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| （本ステージでの自動検証ツールの指定なし） | 未実行 | ステージ定義に本レビュー対象への検証ツールの指定が見当たらず、ツールは実行していない。上記の指摘はすべて、対象ファイルと上流のnfr-requirements・functional-design・U1のnfr-design・contract-summaryとの突き合わせによる手動の確認結果である |

### Summary

最大の懸念は、送信経路の時間予算の計算が、すでに承認済みの上流のnfr-requirements（約8秒・変更不要）と、本書の計算（9.8秒・U1の関数時間切れを8秒から10秒へ変更）とで食い違っており、この食い違いを解消しないまま本番稼働中のLambda設定を変える判断の根拠にしていること（Critical）。加えて、判別回数の上限カウンタの原子性、写真リンク時のトランザクション条件と機能設計の整合、そして構成図が認可境界を迂回して見える点（いずれもMajor）があり、実装者がこのまま構築すると、過去に繰り返した種類の競合バグの再発、機能設計が防いだはずの境界付近の送信失敗、および認可ロジックの迂回という3種の具体的なリスクを抱える。
