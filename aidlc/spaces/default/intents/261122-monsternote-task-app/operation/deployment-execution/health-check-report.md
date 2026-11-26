# Health Check Report — Deployment Execution

デプロイ直後に、CloudFormation・CloudWatchの実際の状態をAWS CLIで確認した（`aws cloudformation describe-stacks`・`aws cloudwatch describe-alarms`）。

## 1. スタックの状態

| スタック | 状態 |
|---|---|
| `MonsterNote-Auth-dev` | `UPDATE_COMPLETE` |
| `MonsterNote-Web-dev` | `CREATE_COMPLETE`（今回の一連のデプロイでは変更なし） |
| `MonsterNote-Data-dev` | `UPDATE_COMPLETE` |
| `MonsterNote-Api-dev` | `UPDATE_COMPLETE`（§の失敗→修正→再デプロイを経た最終状態。`deployment-log.md` §3参照） |
| `MonsterNote-WebContent-dev` | `UPDATE_COMPLETE` |

5スタックとも`_FAILED`・`ROLLBACK_*`状態は残っていない。

## 2. アラームの状態

| アラーム | 状態 |
|---|---|
| `masahiro-cloudwatch-monsternote-api-5xx` | `OK` |
| `masahiro-cloudwatch-monsternote-lambda-errors-0` | `OK` |
| `masahiro-cloudwatch-monsternote-lambda-errors-1` | `OK` |

3個ともAWS上で実際に作られ、`ALARM`状態ではない（スモークテストの1回の報告送信以外の呼び出しはまだ無いため、エラーも発生していない）。

## 3. 無料枠・他プロジェクトへの影響確認

- `mononoke-backend-dev`スタックの`LastUpdatedTime`は`2026-08-19T03:58:14Z`のまま（今回のデプロイで更新されていない）。今回の一連の操作がmononokeのリソースに触れていないことを、AWS上の実際の値で確認した。
- 新規に作られたリソース（DynamoDBテーブル7個・Lambda関数5個・CloudWatchアラーム1個・EventBridgeルール2個等）はすべて従量課金・サーバーレス。EC2・RDS・NAT Gateway等の常時課金リソースは作られていない。
- CloudWatchアラームは3個（無料枠は10個まで無料）、Lambda関数は12個（メモリ128〜256MB、呼び出し課金は無料枠月100万回以内）、DynamoDBは全テーブルPAY_PER_REQUEST。現在の想定利用規模（開発者本人＋少人数の試験運用、月50件未満の報告）では引き続き無料枠の範囲内と見込む。

## 4. 結論

- **Deployment-ready → Deployed**: `dev`環境への反映が完了し、スモークテスト7手順すべて成功（`smoke-test-results.md`）。
- 新たに見つかったCloudWatchアラームの上限超過は、デプロイ実行中に修正済み（`deployment-log.md` §3）。
- 次のOperationステージ（observability-setup・incident-response・performance-validation・feedback-optimization）は未着手。特にperformance-validationは、今回の実機デプロイで初めてdev環境でのp95応答時間の実測が可能になった（Build and TestのNFR2.x「Unverified」の解消先）。
