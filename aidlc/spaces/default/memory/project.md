# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance.
> Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->
<!-- A project that merges into another branch than team.md names says so on its own line, read before team.md's: -->
<!-- - **Integration branch**: develop -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

- AWS `ap-northeast-1`, existing personal sandbox account shared with another project (mononoke). Use the AWS CLI `default` profile.
- Fully serverless. The whole system must run within the AWS Free Tier (target: ~$0/month) for a demo MVP used by a handful of people.
- Tag every resource with `Name=masahiro-<aws-service>-monsternote` (same convention as the account's other project).

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: - NEVER [behavior] (affirmed [date]) -->
<!-- Example: - NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->
- NEVER use always-on or hourly-billed AWS resources (EC2, RDS/Aurora, NAT Gateway, Fargate, ElastiCache, WAF, Route 53 hosted zones) (affirmed 2026-11-23)
- NEVER touch or modify the other project's (mononoke) AWS resources in the shared account (affirmed 2026-11-23)
- NEVER commit secrets (AWS credentials, .env files, passwords); the GitHub repository is public (affirmed 2026-11-23)
- NEVER run load tests that could exceed the Free Tier (affirmed 2026-11-23)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: - ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: - ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->
- ALWAYS check new AWS resources against the Free Tier and state the expected monthly cost before provisioning (affirmed 2026-11-23)
- ALWAYS set API throttling, Lambda memory 128-256 MB, and CloudWatch Logs retention 14 days or less (affirmed 2026-11-23)
- ALWAYS ask the human before running any deploy or destroy against AWS (affirmed 2026-11-23)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- 依存パッケージは古い版に固定せず、設計で決めた系列の中の現在の安定版に上げ、`npm audit` を 0 件に保つ (learned 2026-11-23) <!-- cid:261122-monsternote-task-app:code-generation:066cc756d4980c75572ae85310d84939f91fb93849cc53f67163476b6beb88cf -->
- 新しいUnitのNFR Designの質問を書く前に、前のUnitの実際のinfrastructure-specification.mdを読んで、Lambda関数の構成（統合されているか分かれているか）を確認する。思い込みで「同じ関数にまとまっている」と書かない（U3のreview/catalog関数の誤認識で発覚） (learned 2026-11-24) <!-- cid:261122-monsternote-task-app:code-generation:4f36fff1163d1cb545b153231afccbd78bb0f33a31c8bf39ad2de5f7bba09397 -->
- Code Generationの計画をPlan Approvalで提示するとき、計画書の中に埋もれている重大なスコープ決定（例: 画面の一部を作らないため、その機能が実際には完了できなくなる）は、承認を求める要約の中で明示的に説明する。計画書に書いてあるだけでは不十分（U2のハンター画面3/8のみ実装で発覚） (learned 2026-11-24) <!-- cid:261122-monsternote-task-app:code-generation:a7b0dec867beaa95e77bbbdca638baea685c1785821e9bea69eaede89847a94e -->
- cdk.out/はアプリのビルド成果物であり、.gitignoreにも記載されているのに実際にはgit管理下にあった。並行Unit（swarm）のマージのたびに無駄な競合を起こすため、発見したら即座にgit rm --cached -r infra/cdk.outで追跡から外す (learned 2026-11-24) <!-- cid:261122-monsternote-task-app:code-generation:2c2d8d084107373a7c7f48dc598daa8280c562c953cfb01ecc4e3786cc650a5c -->
- 複数のUnitをswarmで並行してCode Generationした場合、各Unitのインフラ構成試験（stacks.u3.test.tsなど）は「自分のUnitは関数・表を増やさない」という自己完結した前提で書かれており、他のUnit（例: U2）が同時に増やした分を数に入れていない。マージ後は必ず全体のテストを再実行し、件数のズレを直す (learned 2026-11-24) <!-- cid:261122-monsternote-task-app:code-generation:6b23247825aea9eb9f173d790e122346794a51f016dbbd1f6ce73743ee52bc9c -->
