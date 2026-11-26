**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | `construction/u3-review-list/nfr-requirements/observability-requirements.md` > NFR11.17 | NFR11.17 は、409 ALREADY_DECIDED と 409 ALREADY_UNDONE のどちらでも「弾かれた人」と「確認済みの人」を accountId で記録すると書いているが、`rules.md` の BR3.10（取り消しが成功すると確認の記録＝decidedByAccountId を含めて消す）により、ALREADY_UNDONE（本人の取り消しの二重送信）が起きた時点では記録からすでに decidedByAccountId が消えている。NFR11.17 の文面どおりに記録から読もうとすると、この項目は求められた形で取れない。実装者が「レコードから確認済みの人を読む」という自然な読み方をすると、この場合だけ値が欠ける／誤って空文字や null を記録する、という抜け穴になる。 | NFR11.17 に、ALREADY_UNDONE のときの「確認済みの人」はレコードからではなく、呼び出した本人（＝取り消しを許される唯一の人である decidedByAccountId と同一）の認証情報から得る、という出所を明記する。あわせて単体試験の対象にこの経路を含める。 | New |
| R-02 | Major | `construction/u3-review-list/nfr-requirements/scalability-requirements.md` > NFR12.9 と `performance-requirements.md` > NFR2.12（「守れないときは、読む上限（2,000 件）を下げて対処する」） | NFR12.9 は「読み出しの回数が増えても、メモリは増やさない（時間で対処する）」と決め、Lambda のメモリを増やして遅さに対処する道をあらかじめ閉じている。一方 NFR2.12 が示す唯一の対処法は「読む上限を下げる」で、これは BR4.7・BR4.8（絞り込みの件数・全件数の計算）の挙動を変える、つまり機能面の後退になる。つまり、dev の実測で 3 秒の目標を割り込んだときに、**性能にだけ効き、機能を変えない対処法がどこにも用意されていない**（メモリ増は禁じられ、上限を下げる案は仕様の変更を伴う）。これは U1 の NFR12.2「重いものだけ 256 MB」の例外も U3 では使えないと明言したことによる、2 つの NFR 文書間の未調整な対処方針である。 | NFR12.9 に「性能の目標（NFR2.12）を dev の実測で割り込んだ場合は、絞り込みの読み出し関数に限り 256 MB まで引き上げてよい」という例外を明記するか、NFR2.12 の代替案（例: ページごとの早期打ち切りの基準見直し）を機能を変えずに追加する。どちらかを選び、2 つの文書の対処方針を一致させる。 | New |
| R-03 | Minor | `construction/u3-review-list/nfr-requirements/observability-requirements.md` > NFR14.4 | NFR14.4 は「U3 が送る知らせ: 却下（`review.rejected`）、取り消し（`review.undone`）」と書くが、`inception/contract-design/contract-summary.md` の C15 によれば、監査の知らせは単一の `audit.recorded`（`action` 項目に `report.submitted` のような文字列を入れる形）であり、`review.rejected`・`review.undone` という名前の知らせは契約上存在しない。`review.status-changed`（C13）と混同した書き方にも読め、実装者が存在しない知らせの型を作ってしまう恐れがある（U2 の NFR14.2 にも同じ曖昧さがあるが、U3 でも引き継がれている）。 | 「`audit.recorded` の `action` に `review.rejected`／`review.undone` を入れて送る」という形に書き換え、C15 の形と一致させる。 | New |
| R-04 | Minor | `construction/u3-review-list/nfr-requirements/security-requirements.md` > NFR4.11 | NFR4.11 は「`undoUntil` は操作した本人にだけ返す」とだけ書き、`rules.md` BR3.15 が定める「かつ今の時刻が undoUntil 以前であるとき」という期限の条件を落としている。このままでは、本人であっても 10 秒を過ぎたあとは `undoUntil` を返さない、という挙動が NFR の文面からは読み取れず、確かめ方の列（「他人の依頼元の応答に undoUntil がないこと」）も期限切れのケースを試験対象にしていない。 | NFR4.11 の要件文に「かつ 10 秒の期限内のときだけ」を明記し、確かめ方に「期限切れ後は本人にも返さない」ケースを追加する。 | New |
| R-05 | Minor | `construction/u3-review-list/nfr-requirements/performance-requirements.md` > NFR2.12 と「2. 絞り込みの読み出しの見込み」の表 | 見込みの表は「1 回あたり数十ミリ秒」×「20 回ほど」で「1 秒未満」としているが、数十ミリ秒の上限側（例: 80〜90 ミリ秒）を取ると 20 回で 1.6〜1.8 秒になり得て、「1 秒未満」の見込みとは必ずしも一致しない。128〜256 MB という低いメモリでの Lambda のコールドスタートや API Gateway のオーバーヘッドも見積もりに含まれていない。本文中で「assumption」として dev で実測する旨は書かれているが、NFR2.12 自体は「95% のリクエストで 3 秒以内」という確定の目標として立てられており、見込みの粗さとのギャップがある。 | 見込みの表の「1 回あたり」の数字に幅（最良・最悪）を示し、最悪値でも 3 秒の予算内に収まることを確認するか、収まらない場合は NFR2.12 を「dev の実測で確定するまでは暫定目標」と明記する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (stage定義に検証ツールの指定なし) | 実行せず | NFR Requirements ステージの定義に validation tools の指定がなかったため、手作業でのクロスチェック（rules.md の BR3/BR4 との突き合わせ、U1・U2 の NFR ID・アラーム予算・費用予算との整合、contract-summary.md C3/C4/C13/C14/C15 とのスキーマ突き合わせ）で代替した。 |

### Summary

U3 の NFR 要件は全体として rules.md の条件付き書き込み（BR3.3・BR3.9・BR3.11・BR3.15）や U1・U2 のアラーム予算・費用予算・技術選択と整合しており、traceability.json の N/A 判定（NFR6・NFR8・NFR9）も妥当である。ただし、取り消しの二重送信時の監査ログ項目（NFR11.17）が BR3.10 の記録削除と噛み合わない点、および性能目標（NFR2.12）を割り込んだときの対処手段がメモリ増の禁止（NFR12.9）によって機能変更一択に追い込まれている点は、実装前に明文化しておくべき未調整であり、Major として挙げた。Minor の 3 点（監査の知らせの名前、`undoUntil` の期限条件の欠落、読み出し見込みの粗さ）は文書の精度を上げる修正で足りる。
