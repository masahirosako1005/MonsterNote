## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-23T06:12:17Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR5.2 と NFR7 | FR5.2 は「成獣／幼獣・捕獲の方法」を 1 つの画面にまとめる。この画面に必要な大きなボタンは 2 個と 3 個で合計 5 個になり、NFR7 の「報告の作成の各画面の大きなボタンは 1〜3 個」に反する。FR2.1 の画面順にもこの画面がなく、OQ-2 は「ステップ数の表示」だけを未解決とし、この矛盾には触れていない。 | 矛盾を解消する。成獣／幼獣と捕獲の方法を 2 画面に分けるか、NFR7 に例外を明記する。あわせて FR2.1 の画面順を更新する。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR3.1・FR3.3 | 種類の自動判別に合否の基準がない。「判別できなかったとき」の条件（確信度のしきい値など）も未定義で、QA がテストを書けない。判別の結果を前もって選んだ状態で見せるため、誤判別がそのまま確定しやすい。 | 「判別できなかった」とする条件（例: 確信度が X 未満）と、試験用の画像セットでの目標正答率を定める。決められない場合は、仮定として理由を添えて記載する。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR2.4・FR6.1・A-2 | 日時・位置を手入力できるが、入力値の検証がない。未来の日時、極端に古い日時、対象地域の外の位置を弾く条件がない。重複の検出（FR6）は入力値に頼るため、位置や日時をずらすだけで検出を避けられる。この回避の手口は、成功の判定②（同じ値での再報告）では確かめられない。 | 手入力の検証規則（日時は未来不可・過去の上限、位置は対象地域内など）を加える。重複の回避への対応（依頼元の目視に任せる点を含む）を、要件か範囲外か仮定のどれかで明記する。 | New |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR1.1・FR10.1・6. 範囲外 | 管理者がアカウントを作成して招待するが、初期パスワードの渡し方、変更の強制、パスワードの規則、管理者による再設定の操作が要件にない。範囲外で「パスワードの再設定は管理者が対応する」としながら、FR10.1 にその操作がない。無効化したアカウントの既存セッションと既存の報告の扱いも書かれていない。 | FR10.1 に、招待時の初期認証情報の扱い、管理者によるパスワードの再設定、無効化の効果（ログイン不可、報告は残るか）を加える。 | New |
| R-05 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR8.5・FR8.6 | 「数秒間」（取り消し）と「ほぼ同時」（同時操作）に、測れる値がない。FR8.5 の取り消しと FR8.6 の先着判定がぶつかる場合（取り消し中に別の依頼元が操作する）も定めていない。 | 取り消しの猶予を秒数で定める。先着の判定はサーバー側の確定の順序と定義する。取り消し中に別の人が操作したときの動作を決める。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR6.1 | 2 人のハンターが同じ個体をほぼ同時に送ると、互いの報告が見えず、どちらも重複の疑いにならない。距離の計算方法（球面距離など）も書かれていないので、FR6.2 の「ちょうど 1 km」を厳密にテストできない。 | 送信時の判定だけで足りるかを仮定として明記する（または一覧側の事後検出を加える）。距離の計算方法と許容誤差を書く。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR1.6・FR2.3・FR2.12・NFR14 | 認証の有効期限の長さがない。全身の写真に位置情報がなく尻尾の写真にある場合の扱いが未定義。HEIC を受け付ける際の撮影情報の読み取りと種類判別への影響が不明。FR2.12 の 15 MB と NFR2 の 10 MB の関係も不明。監査記録の保存期間と置き場所がなく、NFR11 の「ログ 14 日以内」と両立するかが不明。 | それぞれ値または方針を 1 行ずつ追記する。 | New |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR2.1・FR5.1 | クマの胸の写真が必須かどうかが書かれていない。撮れなかった場合に送信できるのか不明。FR1.4 の同意の撤回の扱いも書かれていない。 | 必須かどうか、撮れない場合の動作、同意撤回の扱い（範囲外でもよい）を明記する。 | New |

### Summary

全体としては、Q1〜Q12 の確定回答への対応が丁寧で、traceability.json も FR/NFR のすべての ID を正しい kind/of で網羅している（欠落・不整合なし）。一方で、NFR7 と FR5.2 の矛盾、種類判別の合否基準の欠如、手入力値の検証の不在、管理者の資格情報の扱いの欠落、曖昧語の残存という Major が 5 件あり、設計に着手する前に直す必要がある。
