// Accounts の関数の入口: API（C1 のログイン・初回の手続き・管理者のアカウント管理の道）と、
// 内部の直接の呼び出し（C10 report-eligibility・U4 caller-status）
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createAccountsRepository } from '../accounts/repository';
import { createAdminCounterRepository } from '../accounts/admin-counter';
import { createSessionRoutes } from '../accounts/session';
import { checkReportEligibility, isEligibilityRequest } from '../accounts/eligibility';
import { checkCallerStatus, isCallerStatusRequest } from '../accounts/caller-status';
import { createChangePasswordRoute } from '../accounts/change-password';
import { createConsentRoute } from '../accounts/consent';
import { createHunterNumberRoute } from '../accounts/hunter-number';
import { createGetMeRoute } from '../accounts/get-me';
import { createCreateAccountRoute } from '../accounts/create-account';
import { createPasswordResetRoute } from '../accounts/password-reset';
import { createSetStatusRoute } from '../accounts/set-status';
import { createListAccountsRoute } from '../accounts/list-accounts';
import { requireEnv } from '../shared/env';
import { createHttpHandler, type HttpEvent } from '../shared/http';
import { createLogger } from '../shared/logger';

const logger = createLogger('accounts');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const accountsTable = requireEnv('ACCOUNTS_TABLE');
const adminCounterTable = requireEnv('ADMIN_COUNTER_TABLE');
const accounts = createAccountsRepository(ddb, accountsTable);
const adminCounter = createAdminCounterRepository(ddb, adminCounterTable);
const cognito = new CognitoIdentityProviderClient({});
const userPoolId = requireEnv('USER_POOL_ID');
const eventBridge = new EventBridgeClient({});
const busName = requireEnv('EVENT_BUS_NAME');

const http = createHttpHandler(
  {
    ...createSessionRoutes({
      cognito,
      clientId: requireEnv('USER_POOL_CLIENT_ID'),
      accounts,
    }),
    'PUT /v1/me/password': createChangePasswordRoute({ cognito, userPoolId, accounts }),
    'PUT /v1/me/consent': createConsentRoute({ accounts }),
    'PUT /v1/me/hunter-number': createHunterNumberRoute({ accounts }),
    'GET /v1/me': createGetMeRoute({ accounts }),
    'GET /v1/admin/accounts': createListAccountsRoute({ accounts, adminCounter }),
    'POST /v1/admin/accounts': createCreateAccountRoute({
      cognito,
      ddb,
      userPoolId,
      accountsTable,
      adminCounterTable,
      eventBridge,
      busName,
      logger,
    }),
    'PUT /v1/admin/accounts/{accountId}/status': createSetStatusRoute({
      ddb,
      accountsTable,
      adminCounterTable,
      accounts,
      eventBridge,
      busName,
      logger,
    }),
    'POST /v1/admin/accounts/{accountId}/password-reset': createPasswordResetRoute({
      cognito,
      userPoolId,
      accounts,
      eventBridge,
      busName,
      logger,
    }),
  },
  logger,
  // accounts 関数自身は Accounts の表を直接読めるため、ほかの関数のような内部の呼び出しは要らない
  {
    passwordGate: async (caller) =>
      (await accounts.getById(caller.accountId))?.mustChangePassword ?? false,
  },
);

export const handler = async (event: unknown) => {
  if (isEligibilityRequest(event)) return checkReportEligibility(accounts, event);
  if (isCallerStatusRequest(event)) return checkCallerStatus(accounts, event);
  return http(event as HttpEvent);
};
