## Q1. [運用] コスト配分タグ（`Project`）をAWS Billingで有効化するか

`cost-analysis.md` §2のとおり、すべてのリソースに`Project: monsternote`タグは正しく付いているが、AWS Cost Explorerでタグ別の内訳を見るには、Billing設定で「コスト配分タグ」として別途有効化する必要がある（現状は未有効化とみられ、タグ別の内訳が取得できなかった）。team.md/project.mdが前提とする「タグ別に請求コンソールで確かめる」運用には、この有効化が必要。これは共用アカウント全体（mononokeも含む）のBilling設定の変更になる。

A. 有効化する（次にAWSコンソールにログインしたときに、Billing → Cost Allocation Tags で`Project`を有効化する）
B. 今回は見送る（実測の合計金額が$0であることはすでに確認できているため、タグ別の内訳までは当面不要とする）
X. Other (please specify)

[Answer]: B（2026-11-26・AskUserQuestionで確認・記録bf3f347f）

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
