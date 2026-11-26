# Anomaly Config — Observability Setup

入力: `construction/u1-skeleton/infrastructure-design/monitoring-design.md`（固定閾値のアラーム 2 個の設計）、`construction/u1-skeleton/infrastructure-design/infrastructure-specification.md` §4（試験運用の規模: 月数円以内の費用見込み、利用者 20 人程度）、`operation/deployment-execution/smoke-test-results.md`（実際の負荷: 1 回の報告送信のみ）、project.md の Forbidden（無料枠を超える負荷試験の禁止）。

## 1. 結論: 今回は CloudWatch の異常検知（Anomaly Detection）を有効化しない

CloudWatch には、固定の閾値ではなく過去の実績から統計的な「正常の範囲（帯）」を学習し、そこから外れたときに知らせる Anomaly Detection 機能がある（`AWS::CloudWatch::AnomalyDetector` ＋ `Alarm` の `comparisonOperator: LESS_THAN_LOWER_OR_GREATER_THAN_UPPER_THRESHOLD`）。本ステージで検討した結果、**現時点では採用しない**。理由は次のとおり。

- 異常検知モデルは、意味のある帯を学習するのに最低でも 2 週間程度の継続的なデータが必要とされる。このプロジェクトの実際の利用規模（`infrastructure-specification.md` §4: 月 50 件未満の報告、利用者 20 人程度、スモークテストの時点ではまだ 1 回の送信のみ）では、呼び出しの密度がまばらすぎて、学習した帯が「ほぼ常に外れる」か「異常の帯が広すぎて何も検知しない」かのどちらかになりやすい。
- 固定閾値のアラーム（`masahiro-cloudwatch-monsternote-api-5xx` の「5 分で 5% 超、呼び出し 5 回以上」、`lambda-errors-0`/`-1` の「5 分で合計 3 回以上」）は、この規模では既に十分に意味のある閾値として機能している（`alarms.md`）。この規模で異常検知に切り替える動機が乏しい。
- project.md の Forbidden（無料枠を超えうる負荷試験の禁止）により、モデルの学習データを人工的に増やす負荷試験も行えない。実際のトラフィックが育つのを待つしかない。

費用面では Anomaly Detection 自体は無料（モデルの学習・保持に追加費用は無い）で、それを使うアラームも通常のアラームと同じ無料枠（10 個まで）を消費するだけなので、費用が採用を妨げているわけではない。妨げているのは、このプロジェクトの実際のトラフィック量である。

## 2. 将来有効化する基準（今回決めておく。Feedback & Optimization で再検討する入口）

次のいずれかに該当したら、Anomaly Detection の採用を Feedback & Optimization で再検討する。

| 基準 | 目安 |
|---|---|
| 継続的な利用が 2 週間以上続いている | 毎日コンスタントに報告の送信・承認が発生している（試験運用が「お試し」から「日常利用」に移行した状態） |
| 固定閾値のアラームが「鳴らなすぎる」または「鳴りすぎる」と感じられている | 例えば API の呼び出し数が増えて、5xx の閾値（5%）が実態に対して粗すぎる／細かすぎると判断される |
| Latency の「通常の変動幅」が時間帯・曜日で変わってきている | 固定の閾値では捉えにくい周期的な変動が観測される |

## 3. 有効化する場合の実装の見積もり（参考。未実装）

対象として最も意味がありそうなのは、`AWS/ApiGateway` の `Latency`（API 全体の応答時間）。固定の p95 目標（`slo-config.md`）と異常検知を併用し、固定閾値のアラームは残したまま、異常検知は別のアラームとして追加する構成が考えられる（CloudWatch のアラーム無料枠は現在 3/10 使用中のため、1 個追加しても枠内に収まる）。実装する場合は `infra/lib/api-stack.ts` に `Metric.createAlarm` ではなく、`new CfnAnomalyDetector(...)` と帯を参照する `Alarm`（`metric: anomalyDetector.toMetricExpression()` 相当。CDK のバージョンにより API が異なるため、実装時に `aws-cdk-lib/aws-cloudwatch` の該当バージョンのドキュメントを確認すること）を追加する。

## Assumptions & Open Questions

- 「2 週間以上の継続的な利用」という基準は、AWS の一般的な異常検知モデルの学習期間の目安に基づく本ステージの判断であり、厳密な統計的根拠を個別に検証したものではない。実際に採用を検討する段階で、CloudWatch のドキュメントで最新の推奨学習期間を確認すること。 [assumption]
- 試験運用の実際の利用がどの程度の頻度になるか（週次か、日次か、散発的か）は、本ステージの時点ではまだ観測できていない（`smoke-test-results.md` の 1 回の送信のみ）。§2 の基準を実際に満たす時期は、運用が進んでから判断する。 [assumption]
