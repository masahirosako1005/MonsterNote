// CDK アプリの入口。デプロイは人の承認のあと手元から行う（project.md・team.md）。
// アラームのメールの宛先は -c alarmEmail=... で渡す（infra/.env.local から。リポジトリに書かない）。
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { App } from 'aws-cdk-lib';
import { buildMonsterNote } from '../lib/monsternote';

const app = new App();
const dist = (name: string) =>
  fileURLToPath(new URL(`../../frontend/${name}/dist`, import.meta.url));
const hunterAssetPath = dist('hunter');
const requesterAssetPath = dist('requester');
for (const path of [hunterAssetPath, requesterAssetPath]) {
  if (!existsSync(path)) {
    throw new Error(
      `画面のビルドがありません: ${path}（先に npm run build:web を実行してください）`,
    );
  }
}

const alarmEmail = app.node.tryGetContext('alarmEmail') as string | undefined;

buildMonsterNote(app, {
  hunterAssetPath,
  requesterAssetPath,
  alarmEmail,
  account: process.env.CDK_DEFAULT_ACCOUNT,
});
