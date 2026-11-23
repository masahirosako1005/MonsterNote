# Phase Check — Ideation → Inception

確認日: 2026-11-23
対象: `ideation/` 配下の成果物（intent-statement、scope-document、intent-backlog、feasibility-assessment、constraint-register、raid-log、wireframes、user-flow、initiative-brief、decision-log）

## 1. Intent → Scope → Intent Backlog の一貫性

| 確認 | 結果 | 内容 |
|---|---|---|
| intent-statement の課題（重複登録による賞金の二重取り）が範囲に入っているか | ✅ 合格 | F6（場所・日時）・F9（送信前の通知）が Must、F7・F8 が Should |
| intent-statement の利用者（ハンター・依頼元）の価値が範囲に入っているか | ✅ 合格 | ハンター: F1・F2・F3・F4。依頼元: F10 |
| 成功基準 3 つが範囲と対応しているか | ✅ 合格 | 1 → F1・F2・F10、2 → F6（F7・F8 で強める）、3 → constraint-register の費用の制約 C-C1〜C-C4 |
| scope-document の In/Out と intent-backlog の MoSCoW が一致しているか | ✅ 合格 | In = Must 8＋Should 2、Out = Won't 3（F5・F11・F12）で一致 |
| intent-statement から外れた項目が、決定として記録されているか | ✅ 合格 | 雌雄の自動判別 → ハンターが選ぶ（decision-log の D-23）。履歴の参照・レポートの出力 → 次の版（D-25）。intent-statement の「除外する機能なし」は Feasibility・Scope Definition の決定（D-22・D-25）で置き換えた |
| 画面案が Must の機能を表しているか | ✅ 合格 | F1 → H1、F2 → H3・H4b、F3 → H4、F4 → H5、F6・F9 → H7、F10 → R2・R3。F13（交付金の項目）は H6 の確認内容に含める。項目の詳細は要件の段階で決める（raid-log の I2） |

## 2. 範囲の各項目に実現性の裏付けがあるか

| 機能 | 優先度 | 実現性（feasibility-assessment） | 結果 |
|---|---|---|---|
| F1 登録・ログイン・同意・従事者番号 | Must | 高 | ✅ |
| F2 写真付きの報告 | Must | 高 | ✅ |
| F3 種類の判別と修正 | Must | 中（実際の写真で早めに試す: raid-log の R3・A2） | ✅（リスクとして記録済み） |
| F4 雌雄の選択 | Must | 高 | ✅ |
| F6 重複の疑い（場所・日時） | Must | 高 | ✅ |
| F9 送信前の通知 | Must | 高 | ✅ |
| F10 依頼元の確認 | Must | 高 | ✅ |
| F13 交付金の項目 | Must | 中（書式が未確定: raid-log の I2） | ✅（課題として記録済み） |
| F7 重複の疑い（写真） | Should | 中 | ✅ |
| F8 クマの月の輪の照合 | Should | 低（余裕があれば挑戦。間に合わなければ次の版） | ⚠️ 実現性が低いことを承知のうえで Should にした（D-24） |

## 3. 結果

**合格（Inception に進める）**。食い違いはなかった。

Inception に引き継ぐ注意点:
- F8 は実現性が低い。Must がすべて終わってから挑戦する
- Must 8 件が 1 か月に収まるかを、Delivery Planning で見積もる
- 交付金の項目（I2）、却下の理由の選択肢と「その他」（R-08）、下書きを残す場所（R-09）、確認が 7 日を過ぎたときの扱いは、要件の段階で決める
