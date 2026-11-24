# Infrastructure Design Questions — U2 `u2-report-duplicate`

U2 の NFR Design はすでに、関数・表・外部サービスの選択（Amazon Rekognition、OpenStreetMap、DetectionRateLimit の表など）を具体的に決めています。U1 の infrastructure-specification.md も「地図のサービスは U1 では使わない。U2 の Infrastructure Design で選ぶ」と、この 1 点だけを U2 に持ち越していました。ここではその選定だけを聞きます。

## Q1. [AWS基盤] 地図のタイルの提供元

NFR Design では「地図の表示は OpenStreetMap のタイルを画面から直接取得する（API を経由しない）」と決めましたが、OpenStreetMap の公式タイルサーバー（`tile.openstreetmap.org`）には、商用・本番アプリでの重い自動利用を避けるよう求める利用方針があり、自前でキャッシュしないアプリがそのまま使うことは推奨されていません。試験運用の規模（利用者 20 人以下）でどちらを選ぶかです。

- A. OpenStreetMap の公式タイルサーバーをそのまま使う（費用 0 円。利用方針どおり、試験運用の規模〈利用者 20 人以下、同時のアクセスはごく少数〉であれば実務上の問題は小さいと判断する。CSP の `img-src` に `https://*.tile.openstreetmap.org` を追加する）
- B. 無料枠のある地図タイルの提供サービス（例: MapTiler・Stadia Maps の無料プラン。月あたりの読み込み回数に上限があるが、利用規約上は小規模な商用利用も想定されている）を使う（アカウント登録とアクセスキーの管理が増えるが、利用方針の懸念がない）
- X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
