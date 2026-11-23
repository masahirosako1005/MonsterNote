# Design System Mapping（デザインシステムとの対応）— MonsterNote

入力: mockups.md、interaction-spec.md、`inception/requirements-analysis/requirements.md`（requirements。NFR7・NFR8・NFR9）、`inception/practices-discovery/team-practices.md`（team-practices。TypeScript・frontend）、`ideation/rough-mockups/wireframes.md`（wireframes）、`ideation/rough-mockups/user-flow.md`（user-flow）、`inception/user-stories/stories.md`（stories）、refined-mockups-questions.md（Q1〜Q5）。

使うもの: **React ＋ MUI（Material UI）**（Q1）。マテリアルデザインに沿う（NFR8）。

## 1. テーマ（色・文字・形）

### 色（Q2: 森の緑、Q3: 明るい画面だけ）

| 役割 | 名前 | 値 | 白い背景とのコントラスト | 使う場所 |
|---|---|---|---|---|
| primary | 森の緑 | `#1B5E20` | 約 7.9:1 | 主なボタン、選択の枠、ヘッダー |
| primary（薄） | 若葉 | `#E8F5E9` | — | 選択中の背景 |
| warning | 橙 | `#E65100` | 約 3.8:1（大きな文字・アイコンのみ。本文は `#BF360C` 約 5.6:1） | 重複の疑い、7 日以上 |
| error | 赤 | `#B71C1C` | 約 7.0:1 | エラー、消す・削除 |
| success | 緑 | `#2E7D32` | 約 5.1:1 | 承認 |
| info | 青 | `#0D47A1` | 約 9.6:1 | 手入力の印 |
| text | 文字 | `#1A1A1A` | 約 17:1 | 本文 |
| background | 背景 | `#FFFFFF` | — | 全体 |

コントラスト比は概算。実装時に検査道具で確かめる（accessibility-checklist）。

### 文字

| 役割 | ハンター側 | 依頼元・管理者側 |
|---|---|---|
| 本文（body1） | 20px | 16px |
| 見出し（h1） | 28px | 24px |
| ボタン | 20px・太字 | 15px・太字 |
| 書体 | 端末の日本語の書体（Noto Sans JP 相当） | 同左 |

ハンター側と依頼元・管理者側は、テーマを 2 つ（`hunterTheme` と `staffTheme`）用意して切り替える。

### 形・間隔

| 項目 | ハンター側 | 依頼元・管理者側 |
|---|---|---|
| ボタンの高さ | 64px 以上 | 40〜48px |
| ボタンの間隔 | 16px 以上 | 8px |
| 角の丸み | 12px | 8px |
| 最大幅 | 600px（中央寄せ） | 制限なし |

## 2. 幅の区切り（Q4）

| 名前 | 幅 | MUI の breakpoint |
|---|---|---|
| スマホ | 〜599px | xs |
| タブレット | 600〜1023px | sm（600）〜 md 未満 |
| パソコン | 1024px〜 | md を 1024 に設定 |

## 3. 画面の部品と MUI の対応

| 画面の部品（interaction-spec） | MUI の部品 | 補足 |
|---|---|---|
| StepHeader | `AppBar` ＋ `LinearProgress`（determinate） | 進み具合の棒 |
| BigChoice | `ToggleButtonGroup`（exclusive）を縦並び、全幅 | radiogroup の役割を付ける |
| 主なボタン（送る・報告する） | `Button` variant="contained" size="large" fullWidth | |
| 2 番目のボタン（選ぶ・撮り直す） | `Button` variant="outlined" | |
| PhotoPicker | `Button` ＋ `input type="file" accept="image/*" capture="environment"`、`Card` ＋ `CardMedia` | 撮る・選ぶは同じ入力で capture の有無を変える |
| DateTimeQuick | `ToggleButtonGroup` ＋ `@mui/x-date-pickers`（DatePicker・TimePicker） | 7 日より前と未来を disable |
| MapPicker | 地図の部品（Infrastructure Design で決める）を `Box` で包む ＋ `Fab`（今いる場所） | requirements の OQ-3 |
| ConfirmDialog | `Dialog`（role="alertdialog"） | |
| 状態の印（確認中・承認・却下・重複・手入力・7 日以上） | `Chip` ＋ アイコン | 色と文字とアイコン |
| ReportTable | パソコン: `Table`、スマホ: `Card` のリスト | |
| 絞り込み | `Chip`（clickable、複数選択） | |
| DecisionBar（取り消し） | `Snackbar` ＋ `Button`（取り消す）＋ `CircularProgress`（残り秒数） | 自動で閉じる時間は 10 秒 |
| 読み込み中 | `Skeleton` / `CircularProgress` | |
| エラー | `Alert` severity="error" | |
| メニュー | `Drawer` | ホーム・ログアウト |

## 4. アイコン（`@mui/icons-material`）

| 意味 | アイコン |
|---|---|
| 確認中 | `HourglassTop` |
| 承認 | `CheckCircle` |
| 却下 | `Cancel` |
| 重複の疑い | `ReportProblem` |
| 手入力 | `Edit` |
| 7 日以上 | `Alarm` |
| 撮る | `PhotoCamera` |
| 選ぶ | `PhotoLibrary` |
| 今いる場所 | `MyLocation` |

## Assumptions & Open Questions

- MUI と date-pickers は無料で使える版（MIT）の範囲で使う。 [assumption]
