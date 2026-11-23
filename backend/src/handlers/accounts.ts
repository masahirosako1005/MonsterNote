// Accounts の関数の入口: API（C1 のログインの道）と、Reporting からの直接の呼び出し（C10）
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createAccountsRepository } from '../accounts/repository';
import { createSessionRoutes } from '../accounts/session';
import { checkReportEligibility, isEligibilityRequest } from '../accounts/eligibility';
import { requireEnv } from '../shared/env';
import { createHttpHandler, type HttpEvent } from '../shared/http';
import { createLogger } from '../shared/logger';

const logger = createLogger('accounts');
const accounts = createAccountsRepository(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  requireEnv('ACCOUNTS_TABLE'),
);
const http = createHttpHandler(
  createSessionRoutes({
    cognito: new CognitoIdentityProviderClient({}),
    clientId: requireEnv('USER_POOL_CLIENT_ID'),
    accounts,
  }),
  logger,
);

export const handler = async (event: unknown) => {
  if (isEligibilityRequest(event)) return checkReportEligibility(accounts, event);
  return http(event as HttpEvent);
};
