## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-23T06:18:02Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR5.2 と NFR7 | FR5.2 は「成獣／幼獣・捕獲の方法」を 1 つの画面にまとめる。この画面に必要な大きなボタンは 2 個と 3 個で合計 5 個になり、NFR7 の「報告の作成の各画面の大きなボタンは 1〜3 個」に反する。FR2.1 の画面順にもこの画面がなく、OQ-2 は「ステップ数の表示」だけを未解決とし、この矛盾には触れていない。 | 矛盾を解消する。成獣／幼獣と捕獲の方法を 2 画面に分けるか、NFR7 に例外を明記する。あわせて FR2.1 の画面順を更新する。 | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR3.1・FR3.3 | 種類の自動判別に合否の基準がない。「判別できなかったとき」の条件（確信度のしきい値など）も未定義で、QA がテストを書けない。判別の結果を前もって選んだ状態で見せるため、誤判別がそのまま確定しやすい。 | 「判別できなかった」とする条件（例: 確信度が X 未満）と、試験用の画像セットでの目標正答率を定める。決められない場合は、仮定として理由を添えて記載する。 | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR2.4・FR6.1・A-2 | 日時・位置を手入力できるが、入力値の検証がない。未来の日時、極端に古い日時、対象地域の外の位置を弾く条件がない。重複の検出（FR6）は入力値に頼るため、位置や日時をずらすだけで検出を避けられる。この回避の手口は、成功の判定②（同じ値での再報告）では確かめられない。 | 手入力の検証規則（日時は未来不可・過去の上限、位置は対象地域内など）を加える。重複の回避への対応（依頼元の目視に任せる点を含む）を、要件か範囲外か仮定のどれかで明記する。 | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR1.1・FR10.1・6. 範囲外 | 管理者がアカウントを作成して招待するが、初期パスワードの渡し方、変更の強制、パスワードの規則、管理者による再設定の操作が要件にない。範囲外で「パスワードの再設定は管理者が対応する」としながら、FR10.1 にその操作がない。無効化したアカウントの既存セッションと既存の報告の扱いも書かれていない。 | FR10.1 に、招待時の初期認証情報の扱い、管理者によるパスワードの再設定、無効化の効果（ログイン不可、報告は残るか）を加える。 | Resolved (reviewer) |
| R-05 | Major | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR8.5・FR8.6 | 「数秒間」（取り消し）と「ほぼ同時」（同時操作）に、測れる値がない。FR8.5 の取り消しと FR8.6 の先着判定がぶつかる場合（取り消し中に別の依頼元が操作する）も定めていない。 | 取り消しの猶予を秒数で定める。先着の判定はサーバー側の確定の順序と定義する。取り消し中に別の人が操作したときの動作を決める。 | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR6.1 | 2 人のハンターが同じ個体をほぼ同時に送ると、互いの報告が見えず、どちらも重複の疑いにならない。距離の計算方法（球面距離など）も書かれていないので、FR6.2 の「ちょうど 1 km」を厳密にテストできない。 | 送信時の判定だけで足りるかを仮定として明記する（または一覧側の事後検出を加える）。距離の計算方法と許容誤差を書く。 | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR1.6・FR2.3・FR2.12・NFR14 | 認証の有効期限の長さがない。全身の写真に位置情報がなく尻尾の写真にある場合の扱いが未定義。HEIC を受け付ける際の撮影情報の読み取りと種類判別への影響が不明。FR2.12 の 15 MB と NFR2 の 10 MB の関係も不明。監査記録の保存期間と置き場所がなく、NFR11 の「ログ 14 日以内」と両立するかが不明。 | それぞれ値または方針を 1 行ずつ追記する。 | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR2.1・FR5.1 | クマの胸の写真が必須かどうかが書かれていない。撮れなかった場合に送信できるのか不明。FR1.4 の同意の撤回の扱いも書かれていない。 | 必須かどうか、撮れない場合の動作、同意撤回の扱い（範囲外でもよい）を明記する。 | Resolved (reviewer) |
| R-09 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR2.14 と 5. 仮定 A-10 | 捕獲日時を「送信の 7 日前まで」とする制限は、報告が遅れた実際のハンターを締め出す可能性がある。却下ではなく送信不可になるため、管理者が例外対応する手段が書かれていない。 | 7 日を超えた場合の扱い（管理者が基準を変えられるか、紙の報告に戻るか）を A-10 に一行で追記する。試験運用前に依頼元へ確認する。 | New |
| R-10 | Minor | aidlc/spaces/default/intents/261122-monsternote-task-app/inception/requirements-analysis/requirements.md > FR1.6・FR1.7・FR1.8 の並び順 | FR1.8 が FR1.7 より前に置かれている。ID の追跡に支障はないが、読み違いのもとになる。 | 並び順を FR1.7 → FR1.8 に整える（任意）。 | New |

> R-01 Reviewer note: FR2.1 は成獣／幼獣と捕獲の方法を別画面にし、通常 7・クマ 8 ステップと明記した。FR5.2 のボタン数（2 個・3 個）は NFR7 の 1〜3 個に収まる。画面案への反映は OQ-2 として後続ステージに明示されている。

> R-02 Reviewer note: FR3.1 で確信度 80% 以上を「判別できた」とし、FR3.5 で 30 枚以上・正答率 70% 以上の確認方法を定義。A-7 に理由と確認時期がある。

> R-03 Reviewer note: FR2.14 で日時（未来 5 分・過去 7 日）と場所（対象地域）の検証を追加し、Given/When/Then もある。回避の残りリスクは A-2 に理由と見直し時期つきで記載されている。

> R-04 Reviewer note: FR1.8（仮パスワード・初回変更・パスワード規則）、FR10.3（再設定）、FR10.4（無効化の効果・1 時間以内・記録の保持・有効化）が追加された。

> R-05 Reviewer note: FR8.5 で猶予 10 秒、FR8.6 でサーバー受付順の先勝ちと取り消し中の扱いを定義。測定可能である。

> R-06 Reviewer note: FR6.2 で大円距離（半径 6,371 km・誤差 1 m）、FR6.4 で保存後の再判定と両方への印付けを追加。

> R-07 Reviewer note: FR1.6（30 日）、FR2.3（全身→尻尾の順）、FR2.12（HEIC・15 MB・縮小）、NFR14（監査記録の保存と 14 日ログの区別）で各 1 点が解消した。

> R-08 Reviewer note: FR2.13 で胸の写真は任意と明記、FR10.5 で同意取り消しの扱い（管理者が無効化）を明記した。

### Summary

前回の R-01〜R-08 はすべて、測定可能な値・仮定・理由つきで解消されており、traceability.json にも新規 ID（FR1.8、FR2.13、FR2.14、FR3.5、FR6.4、FR10.3〜10.5）が含まれている。新たな指摘は Minor 2 件のみで、エンジニアリングは質問なしで着手できる。
