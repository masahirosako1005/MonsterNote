// MonsterNote-Auth-dev: Cognito のユーザープール・アプリのクライアント・グループ（NFR4.1・NFR4.5、security-design）
import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnUserPoolClient,
  CfnUserPoolGroup,
  UserPool,
  type UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export class AuthStack extends Stack {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, 'UserPool', {
      // 管理者（U1 はスクリプト）だけがユーザーを作る
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      standardAttributes: { fullname: { required: false, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.NONE,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      generateSecret: false,
      authFlows: { userPassword: true, userSrp: true },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
    });
    // リフレッシュトークンの更新（rotation）: 出し直しのたびに新しい値（30 日）を出し、古い値は 60 秒の猶予のあと使えなくする
    (this.userPoolClient.node.defaultChild as CfnUserPoolClient).addPropertyOverride(
      'RefreshTokenRotation',
      {
        Feature: 'ENABLED',
        RetryGracePeriodSeconds: 60,
      },
    );

    for (const group of ['hunter', 'requester', 'admin']) {
      new CfnUserPoolGroup(this, `Group-${group}`, {
        userPoolId: this.userPool.userPoolId,
        groupName: group,
      });
    }
  }
}
