# Team Allocation（Bolt の担当）— MonsterNote

入力: bolt-plan.md、`inception/units-generation/unit-of-work.md`（unit-of-work）、`inception/practices-discovery/team-practices.md`（team-practices）、`ideation/approval-handoff/initiative-brief.md`（体制）、delivery-planning-questions.md。

**Bolt** は、1 つ以上の Unit（作る単位）をまとめて、動くものができるところまで一通り作る 1 回分の作業。**mob**（モブ）は、1 つの Bolt を一緒に作るチーム（人と AI エージェントの組み合わせ）。

Team Formation は「開発者 1 人＋AI」のためスキップした。そのため、すべての Bolt を AI の開発者エージェント（aidlc-developer-agent）が作り、開発者本人が確認・承認する。

## 1. 担当

| Bolt | Unit | 作る（mob） | 確認・承認 | デプロイの確認 |
|---|---|---|---|---|
| Bolt 1（細い版） | U1 | aidlc-developer-agent | 開発者本人 | 開発者本人（毎回） |
| Bolt 2 | U2（Must） | aidlc-developer-agent | 開発者本人 | 開発者本人（毎回） |
| Bolt 3 | U3 | aidlc-developer-agent（Bolt 2 と別の作業ブランチ） | 開発者本人 | 開発者本人（毎回） |
| Bolt 4 | U2（Should） | aidlc-developer-agent | 開発者本人 | 開発者本人（毎回） |
| Bolt 5 | U4 | aidlc-developer-agent | 開発者本人 | 開発者本人（毎回） |

## 2. 同時に進めるときの分担

Bolt 2 と Bolt 3 は同時に進める（bolt-plan の Q7）。AI の開発者エージェントが、それぞれ別の作業ブランチで作り、それぞれ PR を作る。開発者本人は 2 つの PR を GitHub の画面で確かめ、Squash and merge で取り込む（team-practices）。取り込みで衝突したときは、後に取り込む PR の側で直す。

## 3. 開発者本人の役割

- 各 Bolt の計画（Code Generation の計画）を承認する
- PR を確かめて取り込む
- AWS へのデプロイ・削除の前に確認する（project.md）
- 細い版（Bolt 1）が dev で動くことを確かめて承認する
- タグ別の費用を確かめる（bolt-plan の各 Bolt の完了条件）

## Assumptions & Open Questions

- 開発者本人が確認に使える時間は、1 か月の中で平日 1〜2 時間程度と見込んでいる（AI が作り、人が確かめる形）。 [assumption]
