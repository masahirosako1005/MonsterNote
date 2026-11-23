// MonsterNote-Web-dev: 画面の S3 ×2 と CloudFront ×2（OAC、セキュリティのヘッダー）。画面のファイルは置かない（WebContent が置く）。
// CSP は API と写真の S3 の具体の URL を使わず、地域の範囲で指定する（infrastructure-specification。Web を API より先に作れるようにするため）。
import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

const REGION = 'ap-northeast-1';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // MUI のスタイルのため style だけ inline を許す
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://*.s3.${REGION}.amazonaws.com`,
  `connect-src 'self' https://*.execute-api.${REGION}.amazonaws.com https://cognito-idp.${REGION}.amazonaws.com https://*.s3.${REGION}.amazonaws.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export interface SiteResources {
  bucket: Bucket;
  distribution: Distribution;
}

class Site extends Construct implements SiteResources {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, headers: ResponseHeadersPolicy) {
    super(scope, id);
    this.bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // 中身があると消せないため残す（費用はほぼ 0。作り直すときは人が中身を消す）
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const origin = S3BucketOrigin.withOriginAccessControl(this.bucket);
    const noCache = {
      origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      responseHeadersPolicy: headers,
      compress: true,
    };
    this.distribution = new Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        // ファイル名にハッシュが付いたビルドのファイルは長くキャッシュする
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headers,
        compress: true,
      },
      additionalBehaviors: {
        '/index.html': noCache,
        '/config.json': noCache,
      },
      // SPA: 知らない道は index.html を返す
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
    });
  }
}

export class WebStack extends Stack {
  readonly hunter: SiteResources;
  readonly requester: SiteResources;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const headers = new ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: CONTENT_SECURITY_POLICY, override: true },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.seconds(31536000),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });
    this.hunter = new Site(this, 'Hunter', headers);
    this.requester = new Site(this, 'Requester', headers);
  }

  /** 2 つの画面の Origin（CORS に使う） */
  get origins(): string[] {
    return [this.hunter, this.requester].map(
      (s) => `https://${s.distribution.distributionDomainName}`,
    );
  }
}
