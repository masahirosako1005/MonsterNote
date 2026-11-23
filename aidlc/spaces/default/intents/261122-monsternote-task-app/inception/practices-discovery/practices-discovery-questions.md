# Practices Discovery — 質問

前提: 新規の開発（既存のコードなし）。開発者 1 人＋AI で、最初の版を 1 か月以内に作る。GitHub の公開リポジトリで管理し、AWS のサーバレスで無料枠内（月 100 円以内）に動かす。プロジェクトのルール（project.md）として、デプロイ前に必ず人に確認する、秘密情報をコミットしない、などが決まっている。

担当エージェントの下書き: `team-practices.md`、`evidence.md`（同じフォルダ）。各質問の A が、その下書きでの提案です。

このステージでは、開発の進め方（ブランチ、最初に作る版、テスト、デプロイ、コードの書き方）を決めます。承認されると、ここで決めたことがチームのルール（`aidlc/spaces/default/memory/team.md`）になり、以降のステージで使われます。各質問の `[Answer]:` に記号を書いてください。

## Q1. [リリースエンジニア] 作業をどうやって main ブランチに取り込みますか？

PR（プルリクエスト）は、GitHub の画面で変更内容を確認してから取り込む仕組みです。

A. PR は作らない。作業ブランチを手元で main にまとめて取り込み、push する（1 人で開発するため）
B. 毎回 PR を作り、GitHub の画面で確認してから取り込む（動画教材で PR の画面を見せられる）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q2. [リリースエンジニア] 作業ブランチのコミットは、取り込むときにまとめますか？

AI-DLC では、作業を「Bolt」という小さな単位で進めます。

A. Bolt ごとに 1 つのコミットにまとめて取り込む（squash。main の履歴が Bolt の順に並ぶ）
B. まとめずに、作業ブランチのコミットをそのまま取り込む
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:1

## Q3. [リリースエンジニア] 最初に、端から端まで一通り動く細い版を作りますか？

ウォーキングスケルトン（walking skeleton）とは、部品がきちんとつながることを確かめるために、本当の機能より先に作る最小の版です。

A. 作る。範囲は「ログイン → 写真 1 枚の報告 → 依頼元が承認」とし、AWS の開発環境で動かす
B. 作る。ただし範囲を変える（内容を書いてください）
C. 作らない。最初から機能ごとに作る
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:X 単体試験・結合試験の一部はローカルPC上で実装と試験。結合・総合試験以降をAWS環境で実施を行いたいですが可能でしょうか？

## Q4. [リリースエンジニア] 細い版などが「動いた」ことを、何で確かめますか？

A. 手元で、コードの書き方の確認・型の確認・テストをまとめて実行する（`npm run verify`）。さらに、人が確認してから開発環境にデプロイし、画面や API が動くかを確かめる（`npm run smoke`）
B. 手元のテスト（`npm run verify`）だけで確かめる
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q5. [品質] テストは、実装の前と後のどちらで書きますか？

A. 実装してからテストを書く（test-after）
B. 先にテストを書いてから実装する（TDD）
C. 重複検出などの判定のロジックだけは先にテストを書き、ほかは実装してから書く（組み合わせ）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Q6. [品質] テストで確かめる割合（行カバレッジ 80%）は、どの範囲に求めますか？

`feature` の進め方では、コードの 80% 以上の行をテストで通すこと（行カバレッジ）が下限として決まっています。

A. 自分で書いたアプリのロジック（画面・API）に 80% を求める。AWS の構成を書いたコード（CDK）は割合の対象から外し、代わりに「作られる構成が正しいか」を確かめるテストを書く
B. AWS の構成を書いたコードも含めて、すべてに 80% を求める
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q7. [品質] ブラウザを自動で操作する通しのテスト（E2E）は、いつ動かしますか？

E2E テストは、実際のブラウザで画面を操作して、最初から最後まで動くかを確かめるテストです。

A. GitHub に push するたびの自動チェック（CI）では動かさない。開発環境にデプロイしたあと、手動で動かす
B. push するたびの自動チェック（CI）で毎回動かす
C. E2E テストは作らない
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:B

## Q8. [リリースエンジニア] AWS の環境はいくつ用意しますか？

A. 1 つ（開発・試験運用用の dev）。費用を抑え、1 人で管理しやすくする
B. 2 つ（開発用の dev と、試験運用の本番用の prod）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q9. [リリースエンジニア] AWS へのデプロイは、どうやって行いますか？

プロジェクトのルールで「デプロイの前に必ず人に確認する」と決まっています。

A. 人が確認したあと、手元のパソコンからデプロイする（`cdk deploy`）。GitHub からの自動デプロイは最初の版では入れない
B. GitHub Actions からデプロイする。実行の前に、GitHub の画面で人が承認する仕組みを付ける
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q10. [リリースエンジニア] デプロイした版に印を付け、問題があったら戻せるようにしますか？

A. デプロイのたびに git のタグ（`v0.1.0` など）を付ける。戻すときは、1 つ前のタグの版をデプロイし直す
B. タグは付けない。戻すときは、直前のコミットを手で選んでデプロイし直す
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q11. [開発者] リポジトリの中を、どう分けますか？

A. 1 つのリポジトリの中を、画面（`frontend`）・API（`backend`）・AWS の構成（`infra`）の 3 つに分け、npm でまとめて管理する（npm workspaces）
B. 分けずに、1 つのまとまりとして管理する
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q12. [開発者] コードのコメントや名前（変数名など）は、何語で書きますか？

画面に表示する文字は日本語にします。

A. コードの名前とコメントは英語（GitHub で公開するため）
B. 名前は英語、コメントは日本語（動画教材で読みやすいように）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:B

## Q13. [リリースエンジニア] プロジェクトのルール以外に、「必ず守る」「絶対にしない」と決めたいことはありますか？

すでに決まっているルール（常時課金の AWS サービスを使わない、mononoke のリソースに触れない、秘密情報をコミットしない、デプロイ前に人に確認する など）は、もう登録されています。

A. 特にない
B. ある（内容を書いてください）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

---

以下は、回答を読んで確認が必要になった点の追加質問です。

## Q14. [リリースエンジニア] 作業ブランチのコミットのまとめ方（Q2 の確認）

Q2 の回答が「1」で、どの選択肢かを判断できませんでした。Q1 で「毎回 PR を作る」を選んだので、PR を取り込むときのまとめ方として選んでください。

A. PR ごとに 1 つのコミットにまとめて取り込む（GitHub の「Squash and merge」。main の履歴が作業の単位で並ぶ）
B. まとめずに、PR のコミットをそのまま取り込む（「Create a merge commit」）
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q15. [リリースエンジニア] 試験の場所の分け方と、最初の細い版（Q3 の確認）

Q3 で「単体試験と結合試験の一部は手元のパソコンで、結合試験の残りと総合試験は AWS の環境で行いたいが、可能か」と質問がありました。

**可能です。** 次のように分けられます。
- 手元のパソコン: 単体試験と、結合試験の一部。AWS のサービスは、代わりの部品（モック）や、手元で動く DynamoDB（DynamoDB Local）で置き換えて試す。AWS の費用はかからない
- AWS の開発環境（dev）: 結合試験の残り（ログイン、写真の保存、種類の判別など、本物の AWS サービスを使うもの）と、総合試験。デプロイの前には、ルールどおり人が確認する

あわせて、Q3 で聞いていた「最初に、端から端まで一通り動く細い版を作るか」を選んでください。ウォーキングスケルトン（walking skeleton）とは、部品がきちんとつながることを確かめるために、本当の機能より先に作る最小の版です。

A. 上の分け方で試験する。最初に細い版を作る（範囲は「ログイン → 写真 1 枚の報告 → 依頼元が承認」。手元の試験のあと、AWS の dev で動かして確かめる）
B. 上の分け方で試験する。細い版は作らず、最初から機能ごとに作る
C. まだ決めていない（Not yet defined）
D. 該当しない（Not applicable）
X. Other (please specify)

[Answer]:A

## Q16. [品質] E2E テストを push のたびに動かす場所（Q7 と Q8・Q9 の食い違い）

Q7 で「E2E テストを push のたびの自動チェック（CI）で毎回動かす」を選びました。一方で、Q8 は「AWS の環境は 1 つ」、Q9 は「人が確認してから手元でデプロイ（GitHub からの自動デプロイはしない）」です。このため、push のたびに AWS の環境で E2E テストを動かすことはできません。

A. CI では、AWS を使わずに E2E テストを動かす（画面を GitHub Actions の中で起動し、API は代わりの部品で置き換える）。本物の AWS を使う E2E テストは、人の確認のあと dev にデプロイしてから動かす
B. CI から dev の環境に向けて E2E テストを動かす（dev へのデプロイは手元で行い、CI はすでにデプロイされた環境を試すだけ。GitHub に AWS の読み取り用の設定が要る）
C. Q7 を変え、E2E テストは dev にデプロイしたあとに手動で動かす（Q7 の A）
D. まだ決めていない（Not yet defined）
X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- 取り込み方: 毎回 PR を作り、GitHub の画面で確認してから main に取り込む。PR ごとに 1 つのコミットにまとめる（Squash and merge） [Q1][Q14]
- 試験の場所: 単体試験と結合試験の一部は手元のパソコンで行う（AWS はモックや DynamoDB Local で置き換え）。結合試験の残りと総合試験は AWS の dev で行う [Q3][Q15]
- 最初の細い版（walking skeleton）: 作る。範囲は「ログイン → 写真 1 枚の報告 → 依頼元が承認」で、手元の試験のあと AWS の dev で動かして確かめる [Q15]
- 動いたことの確認: 手元で `npm run verify`（書き方・型・テスト）。人の確認のあと dev にデプロイして `npm run smoke` [Q4]
- テストの書き方: 先にテストを書いてから実装する（TDD） [Q5]
- 行カバレッジ 80%: アプリのロジック（画面・API）に求める。AWS の構成のコード（CDK）は対象外とし、構成が正しいかを確かめるテストを書く [Q6]
- E2E テスト: push のたびに CI で、AWS を使わずに動かす（API は代わりの部品）。本物の AWS を使う E2E は、人の確認のあと dev にデプロイしてから動かす [Q7][Q16]
- AWS の環境: dev の 1 つ [Q8]
- デプロイ: 人が確認したあと、手元のパソコンから `cdk deploy`。GitHub からの自動デプロイは最初の版では入れない [Q9]
- 戻し方: デプロイのたびに git タグ（`v0.1.0` など）を付け、戻すときは 1 つ前のタグをデプロイし直す [Q10]
- リポジトリ: 1 つのリポジトリを frontend / backend / infra に分け、npm workspaces でまとめる [Q11]
- 言語: コードの名前は英語、コメントは日本語。画面の文字は日本語 [Q12]
- 新しい「必ず守る／絶対にしない」の決まり: なし（project.md の既存のルールだけ） [Q13]

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
