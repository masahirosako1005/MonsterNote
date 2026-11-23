// MonsterNote の CDK アプリの組み立て: 5 つのスタックを Auth → Web → Data → Api → WebContent の一方向の依存で作る
import {
  Aspects,
  CfnOutput,
  DefaultStackSynthesizer,
  type App,
  type StackProps,
} from 'aws-cdk-lib';
import { ApiStack } from './api-stack';
import { AuthStack } from './auth-stack';
import { DataStack } from './data-stack';
import { NameTagAspect } from './tagging-aspect';
import { WebContentStack } from './web-content-stack';
import { WebStack } from './web-stack';

export interface MonsterNoteOptions {
  hunterAssetPath: string;
  requesterAssetPath: string;
  alarmEmail?: string;
  account?: string;
}

export interface MonsterNoteStacks {
  auth: AuthStack;
  web: WebStack;
  data: DataStack;
  api: ApiStack;
  webContent: WebContentStack;
}

export function buildMonsterNote(app: App, options: MonsterNoteOptions): MonsterNoteStacks {
  // 共用アカウントの既定の bootstrap（CDKToolkit）に触れないよう、MonsterNote 専用の qualifier を使う
  const common = (): StackProps => ({
    env: { region: 'ap-northeast-1', account: options.account },
    synthesizer: new DefaultStackSynthesizer({ qualifier: 'mnote' }),
  });

  const auth = new AuthStack(app, 'MonsterNote-Auth-dev', common());
  const web = new WebStack(app, 'MonsterNote-Web-dev', common());
  web.addStackDependency(auth);
  const data = new DataStack(app, 'MonsterNote-Data-dev', { ...common(), webOrigins: web.origins });
  const api = new ApiStack(app, 'MonsterNote-Api-dev', {
    ...common(),
    auth,
    data,
    webOrigins: web.origins,
    alarmEmail: options.alarmEmail,
  });
  const webContent = new WebContentStack(app, 'MonsterNote-WebContent-dev', {
    ...common(),
    hunter: web.hunter,
    requester: web.requester,
    hunterAssetPath: options.hunterAssetPath,
    requesterAssetPath: options.requesterAssetPath,
    config: {
      apiBaseUrl: api.apiUrl,
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.userPoolClient.userPoolClientId,
      photoBucketUrl: `https://${data.photoBucket.bucketRegionalDomainName}`,
    },
  });
  webContent.addStackDependency(api);

  // スモークとアカウントを作るスクリプトが使う値（秘密ではない）
  new CfnOutput(api, 'ApiUrl', { value: api.apiUrl });
  new CfnOutput(web, 'HunterUrl', {
    value: `https://${web.hunter.distribution.distributionDomainName}`,
  });
  new CfnOutput(web, 'RequesterUrl', {
    value: `https://${web.requester.distribution.distributionDomainName}`,
  });
  new CfnOutput(auth, 'UserPoolId', { value: auth.userPool.userPoolId });
  new CfnOutput(data, 'AccountsTableName', { value: data.tables.accounts.tableName });

  Aspects.of(app).add(new NameTagAspect());
  return { auth, web, data, api, webContent };
}
