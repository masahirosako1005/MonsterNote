# Scalability Requirements（規模・費用・運用の制約）— U4 `u4-accounts-admin`

入力: `construction/u1-skeleton/nfr-requirements/scalability-requirements.md`（U1 の NFR1.1〜NFR3.2・NFR12.1〜NFR12.4。U4 はこれを引き継ぐ）、`construction/u4-accounts-admin/functional-design/`（rules の BR11・BR12・BR13、entities）、`inception/requirements-analysis/requirements.md`（NFR1・NFR3・NFR12）、nfr-requirements-questions.md（Q1〜Q5）、project.md。

U4 は新しい AWS のサービスを使わない（DynamoDB・Lambda・API Gateway は U1 のまま）。新しく増えるのは、AuditLog の表と、各部品の削除の入口。

## 1. 規模（U4 で足すもの）

| ID | 要件 | 出典 |
|---|---|---|
| NFR3.8 | 利用者は 20 人以下（NFR3）。管理者はそのうち数人を見込む | NFR3 |
| NFR3.9 | 操作の記録は、月 50 件の報告に対する操作（承認・却下・取り消し）と、アカウント・設定の操作を合わせて、月 300 件程度を見込む | NFR3、BR12.5 |
| NFR3.10 | 「すべて削除」で消す件数は、試験運用の期間（数か月）の報告の累計で、数百件を見込む | NFR3、BR13.1 |

## 2. 費用（U4 で足すもの）

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR1.7 | U4 が新しく使うのは DynamoDB の表（AuditEntry・AdminCounter）だけ。MonsterNote の全体で月 100 円以内に収まる | 下の表、タグ別の費用の確認 | NFR1 |

U4 が新しく使う分の費用の見込み（試験運用の規模）:

| サービス | 使う量の見込み | 無料枠 | 見込み |
|---|---|---|---|
| DynamoDB（AuditEntry） | 月 300 件程度の書き込み、数十 MB | 25 GB（常に無料） | 0 円 |
| DynamoDB（AdminCounter） | 1 行だけ。管理者の作成・無効化・有効化のたびに書き換え（月 数回） | 25 GB（常に無料） | 0 円 |
| Lambda（削除の 5 つの入口・AuditLog の受け手） | 月 数百回 | 月 100 万回（常に無料） | 0 円 |
| **U4 の追加分の合計** | | | **0 円** |

新しい関数の実行環境（Lambda）は、AuditLog の受け手と「すべて削除」の入口のために数個増えるが、サーバーレスのため常時課金はない。

## 3. 運用の制約（U4 で足すもの）

| ID | 要件 | 確かめ方 | 出典 |
|---|---|---|---|
| NFR12.10 | AuditLog の関数・削除の入口の関数は、U1 と同じメモリ（128〜256 MB）の範囲を守る | CDK の構成の試験 | NFR12、project.md |
| NFR12.11 | AuditEntry の表には、試験運用の規模で自動の削除（TTL）を設けない（NFR11 のとおり試験運用が終わるまで保存するため） | CDK の構成の試験 | NFR11、BR12.4 |

## Assumptions & Open Questions

- NFR3.9 の月 300 件は、報告の操作（月 50 件 × 3〜4 回の状態変化）とアカウント・設定の操作（月 20 件程度）を足した見込み。 [assumption]
