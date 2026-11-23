# User Stories Assessment — MonsterNote

入力: `inception/requirements-analysis/requirements.md`（requirements）、`inception/practices-discovery/team-practices.md`（team-practices）。

## 判断

**Execute（ユーザーストーリーを作る）**

## 理由

- 利用者に見える機能が中心のアプリである（ハンターの報告、依頼元の確認、管理者の操作）。
- 利用者の種類が 3 つあり（ハンター・依頼元・管理者）、それぞれ目的と使う機器が違う。
- 重複の疑い、同時の確認、取り消しなど、業務の決まりが複雑で、利用者の目線で受け入れ基準を書くと抜けが見つけやすい。
- team-practices で TDD と E2E テストを決めており、ストーリーの受け入れ基準（Given/When/Then）がそのままテストの元になる。
- 最初の細い版（ログイン → 写真 1 枚の報告 → 依頼元が承認）を、ストーリーの単位で切り出せる。

## 考えた要素

| 要素 | 内容 |
|---|---|
| プロジェクトの種類 | 新規開発（Greenfield）、`feature` スコープ |
| 利用者に見える範囲 | ハンターのスマホ画面、依頼元のパソコン・スマホ画面、管理者の画面 |
| 複雑さ | 重複の判定、自動判別と修正、同時操作、入力の確認（requirements の FR6・FR3・FR8・FR2.14） |

## ストーリーが特に役立つところ

- ハンターの報告の流れ（画面が 7〜8 ステップあり、エラーの流れが多い）
- 重複の疑いの扱い（ハンター・依頼元の両方が関わる）
- 依頼元の確認（2 組織・同時操作・取り消し）
- 最初の細い版に入れるストーリーの切り出し（stories.md で 🦴 の印を付けた 6 個）

## Assumptions & Open Questions

None.
