# Risk and Sequencing Rationale（作る順の理由）— MonsterNote

入力: bolt-plan.md、`inception/units-generation/unit-of-work-dependency.md`（unit-of-work-dependency）・`unit-of-work-story-map.md`、`inception/requirements-analysis/requirements.md`（requirements）、`inception/user-stories/stories.md`（stories）、`inception/refined-mockups/mockups.md`（mockups）、`inception/domain-design/components.md`（components）、`inception/contract-design/contract-summary.md`（contract-summary）、`inception/practices-discovery/team-practices.md`（team-practices）、`ideation/feasibility/raid-log.md`、delivery-planning-questions.md（Q1〜Q8）。

**Bolt** は、1 つ以上の Unit（作る単位）をまとめて、動くものができるところまで一通り作る 1 回分の作業。**細い版**（walking skeleton）は、部品がつながることを確かめるために先に作る、端から端まで一通り動く最小の版。

## 1. 使った考え方

点数を付ける方法（WSJF: 価値・急ぎ・リスクの減り方を大きさで割った点数の高い順に並べる方法。Reinertsen、SAFe）は使わない（Q2）。Bolt が 5 つで、依存関係（unit-of-work-dependency）でほぼ順番が決まるため、次の 3 つの理由を文章で書く。

1. **細い版を最初に**（Cockburn の walking skeleton）: 全体がつながることを最初に確かめる（team-practices）。
2. **価値とリスクが大きいものを早く**（Cohn の「価値とリスクで並べる」考え方）: 一番の価値（報告と重複の検出）と一番のリスク（判別・重複・費用）を早めに確かめる。
3. **同時に進められるものは同時に**: 依存のない U2 と U3 を同時に進め、1 か月の期限に間に合わせる（Q4・Q7）。

## 2. 順番の理由

| 順 | Bolt | 理由 |
|---|---|---|
| 1 | Bolt 1（U1 細い版） | ほかのすべての Unit の前提（依存関係）。1 つの CDK アプリ・認証・写真の保存場所・知らせの仕組みがつながり、無料枠の中で動くかを最初に確かめる。費用の心配（Q6）も、ここで最初の実績が取れる |
| 2 | Bolt 2（U2 Must） | 一番の価値（報告の作成と重複の検出、成功の判定②）。一番の技術のリスク（種類の判別、重複の判定）を含む。U2 の中では判別と重複を先に作る（Q1・Q7） |
| 2 | Bolt 3（U3） | Bolt 2 と依存がない（約束どおりの試験用の知らせで試せる）。同時に進めて期限に間に合わせる（Q4・Q7）。依頼元の確認の画面は、成功の判定①（依頼元がすべて確認）に必要 |
| 3 | Bolt 5（U4） | U1〜U3 のデータの削除の入口を足すため、最後になる（依存関係）。細い版では手順書でアカウントを作れるため、試験運用の前までにできればよい |
| 3 | Bolt 4（U2 Should） | Should のため、Must がすべて終わってから。時間が足りなければ次の版に回す（scope-document） |

## 3. 依存関係との対応

依存関係（U1 → U2・U3 → U4）の順を守っている。外れているところはない。

| 依存 | この計画 |
|---|---|
| U2 は U1 を前提 | Bolt 2 は Bolt 1 のあと ✅ |
| U3 は U1 を前提 | Bolt 3 は Bolt 1 のあと ✅ |
| U4 は U1・U2・U3 を前提 | Bolt 5 は Bolt 2・Bolt 3 のあと ✅（U2 の Should の部分〈Bolt 4〉より先でもよい。U4 が使うのは U2 の Must の部分の削除の入口と設定の裏側） |

## 4. リスクと、それを確かめる Bolt

| リスク（raid-log など） | 確かめる Bolt | 手当て |
|---|---|---|
| AWS の費用が月 100 円を超える（Q6 で一番の心配） | Bolt 1 で最初の実績、以後すべての Bolt の完了条件 | 各 Bolt の完了条件に「タグ別の費用の確認」を入れた。常時課金のサービスは使わない（project.md） |
| 1 か月に間に合わない（R1） | Bolt 1 の実績で見直す | U2 と U3 を同時に進める。Should（Bolt 4）は後回しにできる |
| 種類の判別が捕獲後の写真で正しく判別されない（R3） | Bolt 2（仕組み）、試験運用（精度） | 判別できなくてもハンターが直せる。精度は試験運用で確かめる（Q8。要件 FR3.5 の確かめる時期を変更） |
| 別の角度の同じ個体を見逃す（R4） | Bolt 2・Bolt 4 | 場所・日時の判定を先に、写真・月の輪は Should で足す。最終判断は依頼元 |
| U2 と U3 の同時の作業の衝突 | Bolt 2・Bolt 3 の取り込み | 約束（contract-summary）に合わせて作り、衝突は後の PR の側で直す |
| 知らせが失われる・順番が入れ替わる（ADR-008） | Bolt 1（仕組み）、Bolt 3（順番の入れ替わり） | 届け方は NFR Design で決める。受け手の決まりは contract-summary 2.5 |

## 5. 選ばなかった順番

| 案 | 選ばなかった理由 |
|---|---|
| U1 → U2 → U3 → U4 を 1 つずつ（Q4 の A、Q7 の B） | 開発者 1 人なら衝突が少ないが、人は同時に進めて期限に間に合わせることを選んだ（Q7） |
| U3 を先に（Q1 の B） | 一番の価値とリスクが U2 にあるため |
| WSJF の点数で並べる（Q2 の B） | Bolt が少なく依存でほぼ決まるため、点数を付ける手間に見合わない |

## Assumptions & Open Questions

- 種類の判別の精度を試験運用で確かめるため、試験運用の最初の数件で判別が使い物にならないと分かることがある。その場合もハンターが手で選べるため、報告は止まらない。 [assumption]
