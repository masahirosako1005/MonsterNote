// MonsterNote-WebContent-dev: 画面のビルドを 2 つの画面の S3 に置き、実行時の設定 config.json を一緒に置いて、
// CloudFront のキャッシュを無効化する（infrastructure-specification のスタックの表）
import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import type { SiteResources } from './web-stack';

export interface RuntimeConfig {
  apiBaseUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  photoBucketUrl: string;
}

export interface WebContentStackProps extends StackProps {
  hunter: SiteResources;
  requester: SiteResources;
  hunterAssetPath: string;
  requesterAssetPath: string;
  config: RuntimeConfig;
}

export class WebContentStack extends Stack {
  constructor(scope: Construct, id: string, props: WebContentStackProps) {
    super(scope, id, props);
    const logGroup = new LogGroup(this, 'DeploymentLogs', {
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const deploy = (name: string, site: SiteResources, assetPath: string) =>
      new BucketDeployment(this, `${name}Deployment`, {
        sources: [Source.asset(assetPath), Source.jsonData('config.json', props.config)],
        destinationBucket: site.bucket,
        distribution: site.distribution,
        distributionPaths: ['/*'],
        memoryLimit: 128,
        logGroup,
      });
    deploy('Hunter', props.hunter, props.hunterAssetPath);
    deploy('Requester', props.requester, props.requesterAssetPath);
  }
}
