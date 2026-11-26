## Q1. [運用] `scripts/perf-check.ts`を実際に`dev`へ実行するか

`load-test-plan.md`で、約48件の軽い・一度きりの実リクエストを`dev`の本物のAPIに送る計測スクリプトを作成した（負荷試験ではない。project.md/team.mdの無料枠制約の範囲内）。実行すれば、Build and Testが`Unverified`としていたNFR2.x（p95応答時間）を初めて実測できる。実行するか。

A. 今、実行してよい
B. 今回は実行しない（計画のみ記録し、実測は次の機会に見送る）
X. Other (please specify)

[Answer]: A（2026-11-26・AskUserQuestionで確認・記録ae63bcdb。実行結果はtest-results.md参照）

## Q2. [運用] 管理者の試験用アカウントをどう用意するか

`load-test-plan.md` §3bのとおり、実機`dev`にはまだ管理者（role=admin）の試験用アカウントが無い。`scripts/perf-check.ts`の管理者系の計測（NFR2.15〜2.17）には、先に`npm run account:create -- --role admin ...`で1つ作る必要がある。

A. 今、作成する（ログインID・表示名を教えてもらう）
B. 管理者系の計測（NFR2.15〜2.17）は今回は対象から外し、先に作れる項目だけ計測する
X. Other (please specify)

[Answer]: A（2026-11-26・loginId=perfadmin・displayName=計測用管理者で作成。記録: ae63bcdb・3abbe2ec）

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
