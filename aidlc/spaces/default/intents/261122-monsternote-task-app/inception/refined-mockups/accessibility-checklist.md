# Accessibility Checklist（アクセシビリティの確認表）— MonsterNote

入力: mockups.md、interaction-spec.md、design-system-mapping.md、`inception/requirements-analysis/requirements.md`（requirements。NFR7・NFR9）、`inception/user-stories/stories.md`（stories）、`ideation/rough-mockups/wireframes.md`（wireframes）、`ideation/rough-mockups/user-flow.md`（user-flow）、`inception/practices-discovery/team-practices.md`（team-practices。E2E は Playwright）。

基準: **WCAG 2.1 AA**（requirements NFR7）。ハンター側はさらに、文字 20px 以上・ボタン 64px 以上・1 画面の大きなボタン 1〜3 個。

確かめ方の列: 自動＝CI の自動検査（axe など）、手動＝実機・読み上げで確認、デザイン＝この画面案で確認済み。

## 1. 見やすさ

| # | 確認項目 | WCAG | 対象 | 確かめ方 | 画面案の状態 |
|---|---|---|---|---|---|
| A1 | 本文のコントラスト比 4.5:1 以上 | 1.4.3 | 全画面 | 自動 | ✅ 色の値で確認（design-system-mapping） |
| A2 | ボタンの枠・アイコンなど 3:1 以上 | 1.4.11 | 全画面 | 自動 | ✅ |
| A3 | 色だけで意味を伝えない（状態は文字＋アイコン） | 1.4.1 | 状態の印、選択、エラー | デザイン | ✅ |
| A4 | 200% に拡大しても使える | 1.4.4 | 全画面 | 手動 | 実装時に確認 |
| A5 | 幅 320px で横にスクロールしない | 1.4.10 | ハンター側 | 手動 | ✅ 1 列 |
| A6 | ハンター側の本文 20px 以上、ボタン 64px 以上 | （NFR7） | ハンター側 | 自動（E2E で寸法を確認） | ✅ |
| A7 | 屋外での見やすさ（明るい画面、コントラスト高め） | （Q2・Q3） | ハンター側 | 手動（屋外で実機） | ✅ 方針 |

## 2. 操作

| # | 確認項目 | WCAG | 対象 | 確かめ方 | 画面案の状態 |
|---|---|---|---|---|---|
| B1 | すべての操作がキーボードでできる（地図も） | 2.1.1 | 全画面 | 手動・E2E | ✅ MapPicker に矢印＋Enter |
| B2 | フォーカスの順番が見た目の順 | 2.4.3 | 全画面 | 手動 | ✅ |
| B3 | フォーカスが見える | 2.4.7 | 全画面 | 手動 | MUI の既定を強めに |
| B4 | ダイアログの中にフォーカスを閉じ、閉じたら元に戻す | 2.4.3 | ConfirmDialog | E2E | ✅ |
| B5 | 押せる場所は 44×44px 以上（ハンター側は 64px） | 2.5.5（AAA 参考） | 全画面 | 自動 | ✅ |
| B6 | 取り消しの 10 秒は延長できなくてもよい理由がある（操作は本人が 10 秒以内に気づけば戻せる。確定後は管理者に連絡） | 2.2.1 | DecisionBar | デザイン | ✅ 例外として記録 |
| B7 | 消す・削除の前に確認する | 3.3.4 | H-X、A5 | E2E | ✅ |

## 3. 分かりやすさ

| # | 確認項目 | WCAG | 対象 | 確かめ方 | 画面案の状態 |
|---|---|---|---|---|---|
| C1 | ページの言語が日本語（`lang="ja"`） | 3.1.1 | 全画面 | 自動 | 実装時 |
| C2 | 入力のエラーは、どの欄で何を直すかを文字で示す | 3.3.1・3.3.3 | H1・H1a・H6・A2・A3 | E2E | ✅ |
| C3 | 入力欄に見える名前がある | 3.3.2 | 全入力 | 自動 | ✅ |
| C4 | 同じ働きの部品は同じ名前・同じ場所（戻る・やめる） | 3.2.4 | 報告の作成 | デザイン | ✅ StepHeader |
| C5 | 画面が変わったとき、見出し（h1）にフォーカスが移る | 2.4.6 | 報告の作成 | E2E | ✅ |

## 4. 読み上げ（スクリーンリーダー）

| # | 確認項目 | WCAG | 対象 | 確かめ方 | 画面案の状態 |
|---|---|---|---|---|---|
| D1 | 写真・手本の絵に代替テキスト | 1.1.1 | H3・H4b・H6・R3 | 自動 | ✅ |
| D2 | 見出しとランドマーク（header・nav・main） | 1.3.1 | 全画面 | 自動 | ✅ |
| D3 | 状態の変化（送信中・送りました・取り消せます）を知らせる | 4.1.3 | H6・H8・R3 | 手動（VoiceOver・TalkBack） | ✅ aria-live |
| D4 | 選択肢が radiogroup として読まれる | 4.1.2 | BigChoice | 自動 | ✅ |
| D5 | 一覧の表に見出しセル | 1.3.1 | R2・A2・A4 | 自動 | ✅ |

## 5. 確かめる機器（requirements NFR9）

| 機器 | ブラウザ | 読み上げ |
|---|---|---|
| iPhone（最新と 1 つ前の iOS） | Safari | VoiceOver |
| Android（最新と 1 つ前） | Chrome | TalkBack |
| パソコン | Chrome・Edge（最新） | キーボードだけの操作 |

## Assumptions & Open Questions

- 自動の検査は、E2E（Playwright）に axe を組み合わせて CI で動かす前提（team-practices）。道具の選定は Construction で確定する。 [assumption]
