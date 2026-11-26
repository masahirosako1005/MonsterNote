# Cross-Unit Traceability — Build and Test

`aidlc engine sensor-traceability --stage build-and-test` を実行した結果（生の出力は本文書と同じ内容。要約してここに記す）。

**機械的な判定: 不合格（`pass: false`）。** 46件のID（FR・NFR・AC）が「uncovered」と報告された。この判定はBuild and Testの実行結果（ビルド・単体・結合・E2Eはすべて成功）とは独立した、要件とAC単位のトレーサビリティの判定であり、承認ゲートで人に見せる必要がある（stage file Step 10の明記どおり）。

**ただし、下記(a)で見つけた実装の欠落はBuild and Testの中で調査・修正済み**（人に報告・承認済み。詳細は(a)および`test-results.md` §7）。この機械的な判定は、U1・U2のコード生成時点の静的な`traceability.json`を参照する仕組み上、後発のこの修正を反映できず、そのため今も「不合格」のままになっている。実装自体は修正済みであることを、この文書と承認ゲートで明示する。

## 1. 未達のIDと、その理由の分類

調査の結果、未達の46件は性質の異なる4つの集まりに分かれる。

### (a) 承認済みの画面設計（Refined Mockups）と、実際に作られた画面が食い違っていた【解決済み。人に報告・承認のうえ対処】

`inception/refined-mockups/interaction-spec.md`（レビュー済み。`reviews/review-01.md`あり）は、報告の作成を**7画面（クマのときは8画面）**の一連の流れとして明記している:

```
H3 全身 1/7 → H3 尻尾 2/7 → H4 種類 3/7 → (クマ) H4b 胸 4/8 →
H5 雌雄 → H5b 成獣／幼獣 → H5c 捕獲の方法 → H6 確認して送る（各項目に「直す」）
```

実際に作られたハンターの報告の作成の流れは**3画面**（`PhotoPage`→`ChoicePage`→`SubmitPage`。各画面の中にサブステップがある）で、確認画面（`SubmitPage`）に各項目を個別に「直す」リンクで戻れる仕組みはなく、単純な「戻る」だけ。

**調査の結果、この食い違いは画面の構成（7〜8画面か3画面か）だけの問題ではなく、より重大な実装の欠落を伴っていたことが判明した**: `ChoicePage`は種類・雌雄だけを集め、`ageClass`・`captureMethod`を一度も集めておらず、`PhotoPage`は全身の写真しか撮らせず尻尾の写真（必須）・クマの胸の写真（条件付き必須）を一度も撮らせていなかった。`capturedAt`・`capturedAtSource`・`locationSource`も送信していなかった。これらはすべてU2のバックエンド（`backend/src/reporting/submit.ts`）が必須とする項目であり、**この状態では実際のバックエンドへの報告の送信は常に422で拒まれ、一度も成功しない**。単体・E2Eの両試験ともこの必須項目を検証していなかったため、これまで一度も表面化していなかった。

**訂正（追加調査）**: これは実は「誰も知らなかった隠れた欠陥」ではなかった。U2自身の`code-generation/code-summary.md`（§1.6）に、作成の時点ですでに明記されていた: 「既存の3画面構成のみ拡張し、frontend-components.md が描く残り5画面（尻尾・胸の写真、成獣／幼獣、捕獲の方法、捕獲日時の手入力）は作っていない。バックエンドは完全な報告（全項目）の検証を完備しているが、今のフロントエンドの3画面はそれらの項目を集めないため、この画面から実際に送信するとBR2.17の検証で拒まれる。残りの画面は次の作業に持ち越す」。つまりU2の時点で**この欠落は正確に予見され、文書化されていた**が、「次の作業」（U3・U4）のどちらの計画にもこの持ち越しが引き継がれず、Build and Testに至るまで誰も拾わなかった。これは「隠れたバグ」ではなく「計画の引き継ぎの抜け」の実例であり、Unit間でDeferred/持ち越し項目を追跡する仕組みが無いと、明記された既知の制約でも次の工程に承継されず放置されうることを示している。

人に報告し、2回に分けて判断を仰いだ（baa12d2b: 欠落項目の修正方針、51877a19: 画面構成の正式決定）。結果:
1. **欠落していた項目（ageClass・captureMethod・capturedAt・capturedAtSource・locationSource・尻尾の写真・クマの胸の写真）はすべて実装した**（`frontend/hunter/src/pages/{PhotoPage,ChoicePage,SubmitPage}.tsx`・`context.tsx`・`api.ts`。詳細は`test-results.md` §7）。`e2e/mock-api.ts`にも本物と同じ必須項目の確認を追加した。
2. **画面構成は、7〜8画面の原案ではなく、実際の3画面構成（各画面の中にサブステップを持たせる形）を正式な決定として承認し直した。** Interaction Spec原案は歴史的な記録としてそのまま残し、直接の書き換えは行っていない。

この結果、下記の未達の大半（FR2.1〜FR2.8・FR2.10〜FR2.13、AC2.2.1・AC2.2.2・AC2.2.5・AC2.3.1〜3・AC2.4.1〜2・AC2.7.1〜3・AC2.9.1〜3・AC2.10.1〜2）は**実装上は解決済み**だが、`aidlc engine sensor-traceability`が機械的に参照するU1・U2の各`traceability.json`（コード生成時点の静的な記録）はこの後発の修正を反映していないため、下記§4の生の判定には今もこれらが「uncovered」として現れ続ける。これは意図的に残した履歴上のズレであり、実装の欠陥ではない（§3参照）。

### (b) すでに文書化済みの、意図した先送り（新しい発見ではない）

- **FR9.2・AC5.2.1〜3**（ハンターが却下の理由を自分の報告の詳細で見て、「撮り直して新しく報告する」で新しい報告を作れる。wireframes H9）: U3のcode-summary.md §5に「ハンターの却下理由の画面（H9）は作っていない」と明記済み。バックエンド（却下の理由を返す）と共有部品（`ReportDetail`の`reason`・`reasonText`・`onRetry`）は用意済みだが、これを使うハンター側の画面・ルートが無い。U3のtraceability.jsonで`AC5.2.1〜5.2.3`を`Deferred`として記録済みの、既知の繰越項目。
- **FR11.1・AC7.1.1〜3**（重複の疑い「写真」）: FR11.1自身が「Mustの要件がすべて終わったあとに作る」と明記（inception時点での意図した優先度）。U2のasyncapi.yamlのコメントも「U2はplace-timeだけ（Q1）」と明記。意図した未実装。
- **FR12.1・AC7.2.1〜3**（重複の疑い「月の輪」）: FR12.1自身が「実現性が低いため...間に合わなければ次の版に回す」と明記（inception時点での意図した任意要件）。同じくU2のasyncapi.yamlのコメントで確認済み。意図した未実装。

### (c) 設計の後工程で正当な理由により変更され、NFR/BRレベルでは記録されているが、FR/ACレベルの文書に反映されていない

- **FR8.3・AC4.2.2**（依頼元が重複の疑いの詳細で「似ている報告を並べて見比べられる」＝相手の写真を見られる）: U2のBR8.8・NFR5.7が「相手の報告のID・ハンターのID・氏名・写真は入れない」と明記しており、これはFR8.3（wireframes R3由来）と直接矛盾する。NFR5.7は意図的なプライバシー設計（レビューR-03等で確認済みの決定）であり、実装（`GET /v1/duplicates/{reportId}`が種類・距離・時間差・状態だけを返す）もNFR5.7のとおり正しく作られている。**FR8.3自体が、U2の設計時に下位のBR/NFRで上書きされたまま、inceptionの文書に訂正が反映されていない**。実装の不具合ではなく、文書の整合の抜け。

### (d) 上位のロールアップID（個別の未達の集計）

`NFR2`・`NFR9`・`NFR12`は、それぞれの配下に1件以上の未達の個別ID（`u2-report-duplicate: NFR2.10`＝重複の判定の時間の予算の実測、`u2-report-duplicate: NFR9.4`、`u2-report-duplicate: NFR12.6`）を含むため`covered:false`と判定されている。これらの個別IDはいずれも**dev環境での実測が必要な項目**（デプロイ前のBuild and Testでは測れない）であり、下記のTarget Verification Matrixで該当する実行時パフォーマンス系の項目として扱う（performance-validationへの繰越）。新しい発見ではなく、すでにU2のnfr-design/performance-design.mdの各項目が「暫定。dev実測で確定」と明記している内容と同じ。

## 2. 所有するステージ・Unit、対象ファイル

| 分類 | 所有するUnit/ステージ | 対象ファイル（概要） |
|---|---|---|
| (a) 画面構成の食い違い | u1-skeleton・u2-report-duplicate（実装側）／ build-and-test（発見） | `frontend/hunter/src/pages/{PhotoPage,ChoicePage,SubmitPage}.tsx`、`inception/refined-mockups/interaction-spec.md` |
| (b) H9画面の繰越 | u3-review-list（記録済み） | `u3-review-list/code-generation/code-summary.md` §5、`u3-review-list/code-generation/traceability.json` |
| (b) 写真・月の輪の重複検出 | u2-report-duplicate（記録済み） | `contracts/asyncapi.yaml`（duplicate.suspectedのコメント）、inception requirements.md FR11.1・FR12.1 |
| (c) FR8.3とNFR5.7の不整合 | u2-report-duplicate | `u2-report-duplicate/nfr-requirements/security-requirements.md`（NFR5.7・NFR4.7）、`backend/src/duplicate-detection/list.ts` |
| (d) dev実測が要る性能項目 | performance-validation（後続ステージ） | 各Unitの`nfr-design/performance-design.md` |

## 3. この結果の扱い

Build and Testの実行結果（ビルド・単体・結合・E2E・synth）はすべて成功しており、上記はそれとは別の、要件トレーサビリティの観点の判定である。(a)は新規の発見として人に報告し、承認を得てBuild and Testの中で修正済み（§4の生の判定は、コード生成時点の静的な記録を参照する仕組み上、この修正を反映できず、不合格の表示のまま残る。実装自体は解決済みである旨を承認ゲートで明示する）。(b)(c)は新規ではなく、すでに記録済みの繰越・設計変更の確認として提示する。(d)はperformance-validationへの既定の繰越として扱う。

## 4. 生の判定（`aidlc engine sensor-traceability --stage build-and-test`のJSON、`uncovered`配列）

```json
["FR2.1","FR2.2","FR2.3","FR2.4","FR2.5","FR2.6","FR2.7","FR2.8","FR2.10","FR2.11","FR2.12","FR2.13","FR5.1","FR5.2","FR5.3","FR8.3","FR9.2","FR11.1","FR12.1","NFR2","NFR9","NFR12","AC2.2.1","AC2.2.2","AC2.2.5","AC2.3.1","AC2.3.2","AC2.3.3","AC2.4.1","AC2.4.2","AC2.7.1","AC2.7.2","AC2.7.3","AC2.9.1","AC2.9.2","AC2.9.3","AC2.10.1","AC2.10.2","AC4.2.2","AC5.2.1","AC5.2.2","AC5.2.3","AC7.1.1","AC7.1.2","AC7.1.3","AC7.2.1","AC7.2.2","AC7.2.3"]
```

（FR5.1〜5.3は(a)と同じ画面構成の食い違いの一部。FR5.2自身が「画面案にない2画面の追加」と明記しており、その2画面〈成獣／幼獣・捕獲の方法〉が独立した画面としては作られず`ChoicePage`に統合されている点が、FR2.1の7〜8画面の構成と同じ原因で未達になっている。）
