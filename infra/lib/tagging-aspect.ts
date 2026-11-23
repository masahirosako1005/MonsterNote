// すべてのリソースを巡り、リソースの種類ごとに Name=masahiro-<aws-service>-monsternote と Project=monsternote を付ける
// （project.md、NFR1.2。アカウントのもう 1 つのプロジェクトと同じ名前の付け方）
import { CfnResource, TagManager, type IAspect } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';

/** CloudFormation の種類の名前（AWS::Lambda::Function）から、タグに使うサービスの名前を決める */
const SERVICE_NAMES: Record<string, string> = {
  Lambda: 'lambda',
  DynamoDB: 'dynamodb',
  S3: 's3',
  Cognito: 'cognito',
  CloudFront: 'cloudfront',
  ApiGatewayV2: 'apigateway',
  Events: 'eventbridge',
  SNS: 'sns',
  CloudWatch: 'cloudwatch',
  Logs: 'logs',
  IAM: 'iam',
};

export function serviceNameOf(cfnResourceType: string): string {
  const service = cfnResourceType.split('::')[1] ?? 'resource';
  return SERVICE_NAMES[service] ?? service.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class NameTagAspect implements IAspect {
  visit(node: IConstruct): void {
    if (!(node instanceof CfnResource) || !TagManager.isTaggable(node)) return;
    const tags = (node as unknown as { tags: TagManager }).tags;
    // Tags.of の既定（100）より強い優先度で付ける
    tags.setTag('Name', `masahiro-${serviceNameOf(node.cfnResourceType)}-monsternote`, 200);
    tags.setTag('Project', 'monsternote', 200);
  }
}
