<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-24T07:10:00Z — 削除の入口をReview・Reporting・DuplicateDetectionの既存関数に足すと決めた（Q1-A）結果、Reportingの関数はU2ですでに時間切れを9秒に引き上げていたが、削除の最悪見込み（最大1,000件の計画で約2〜6秒）を載せると余裕が乏しいと判断し、Review・Reporting・DuplicateDetectionの3関数の時間切れをU4で揃えて15秒に引き上げた。既存のルート（送信・承認・却下・取り消し・一覧など）の最悪見込みはどれも15秒より十分短く、挙動への影響はないことを表にして確認した。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-24T07:40:00Z — レビュー（iteration 1、READY だが Major 2件）の指摘を受け、reliability-design.md が導入していた `LoginIdLock`（loginId の一意性確認用の内部項目）を撤回した。Cognito 側の作成を先に行う設計（Q3-A）では、loginId をそのまま Cognito のユーザー名にするため、Cognito 自身の `UsernameExistsException` が一意性を保証し、DynamoDB 側の追加の仕組みは不要と判断した。これにより「新しい表は AdminCounter・AuditEntry の2つだけ」という他の文書との食い違いも解消した。
- 2026-11-24T08:05:00Z — iteration 2（READY）で新たに「BR11.2・entities.mdの『条件にした1回の書き込み』という字面が、撤回したDynamoDB側の条件付き書き込みを指しているように読める」という指摘を受けた。機能設計（確定済み・複数回レビュー済み）を直接書き換えるのではなく、reliability-design.md側に「この1回の書き込みをCognitoのAdminCreateUser呼び出しとして実現する」という対応関係の説明を加え、業務の決まり（結果）と実現の手段（レイヤー）を区別して明記する形で解消した。
- 2026-11-24T08:30:00Z — 追加のレビュー確認（iteration 3相当。エンジンのレビュー受領票はiteration 2で確定済みのため記録は受理されなかった）で、reliability-design.mdはCode Generationのconsumes一覧（performance-design・security-designのみ）に含まれず、上の注記が開発者に届く保証がないという指摘を受けた。performance-design.md（consumes対象）の§2に同じ注記を複製し、「DynamoDB側に一意性確認を追加実装してはならない」という指示を、実際にCode Generationが読む文書に明記して解消した。
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
