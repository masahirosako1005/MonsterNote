# External Dependency Map（外部への依存）— MonsterNote

入力: bolt-plan.md、`inception/contract-design/contract-summary.md`（contract-summary。未解決の点）、`inception/requirements-analysis/requirements.md`（requirements。OQ-1〜OQ-4）、`inception/domain-design/components.md`（components。外部のもの）、`ideation/feasibility/raid-log.md`（D1〜D4）、`inception/practices-discovery/team-practices.md`、delivery-planning-questions.md。

**Bolt** は、1 つ以上の Unit（作る単位）をまとめて、動くものができるところまで一通り作る 1 回分の作業。この文書は、チームの外にあって Bolt を止めうるもの（外部のサービス、承認、データ、ほかの人の協力）を、どの Bolt が待つかと対応づける。

| # | 外部への依存 | 持ち主 | かかる時間 | 待つ Bolt | 遅れたときの手当て |
|---|---|---|---|---|---|
| X1 | AWS アカウント（共用の個人のアカウント、無料枠） | 開発者本人 | 準備済み | Bolt 1 | — |
| X2 | AWS へのデプロイ・削除の承認 | 開発者本人 | 各回すぐ | すべての Bolt | 承認まで dev に出さない（手元の試験は進める） |
| X3 | AWS の画像認識サービス（東京リージョン） | AWS | 準備不要 | Bolt 2 | 使えないときは「判別できなかった」で動く（FR3.3） |
| X4 | 地図のサービス（場所の手入力、地名。requirements OQ-3） | 選ぶサービスの提供元 | Infrastructure Design で選ぶ | Bolt 2（手入力の地図・地名）、Bolt 3（一覧の地名） | 決まるまで、地図の部分は緯度・経度の入力と表示で代える。地名は空にする（ADR-012） |
| X5 | 国の交付金の実績報告の最新の項目・書式（requirements OQ-1、raid-log I2） | 国（農林水産省） | Functional Design までに確認 | Bolt 2 | 決まるまで仮の項目（FR5.1）で作る |
| X6 | GitHub（公開リポジトリ、Actions の CI） | 開発者本人 | 準備済み | すべての Bolt | — |
| X7 | 試験運用に参加するハンター数人と依頼元 2 組織の協力（raid-log D1・D2） | 依頼元・ハンター | 試験運用の前に説明 | Construction の後（試験運用）。種類の判別の精度の確認（Q8） | 参加者が揃うまで試験運用を延ばす |
| X8 | 試験運用の対象地域（市町村が決まったら管理者が設定。requirements A-10） | 依頼元 | 試験運用の前 | Bolt 5（設定の画面）、試験運用 | 決まるまで初期値（日本の範囲）で動く |

試験用の写真（種類の判別の精度）は、Q5・Q8 により外部から集めない。精度は試験運用（X7）で確かめる。

## Assumptions & Open Questions

- AI の開発者エージェントの作業は外部への依存なしに進められる。外部を待つのは、上の表のものだけ。 [assumption]
