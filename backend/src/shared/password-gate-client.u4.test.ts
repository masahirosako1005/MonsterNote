// password-gate-client の試験（U4・BR11.4）
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { createRemotePasswordGate } from './password-gate-client';
import type { Caller } from './auth';

const lambdaMock = mockClient(LambdaClient);
const lambda = new LambdaClient({ region: 'ap-northeast-1' });

const payload = (o: unknown) =>
  new TextEncoder().encode(JSON.stringify(o)) as unknown as InvokeCommandOutput['Payload'];

const caller: Caller = { accountId: 'req-1', roles: ['requester'] };

beforeEach(() => lambdaMock.reset());

describe('createRemotePasswordGate', () => {
  it('Accounts 関数を呼び出し、mustChangePassword を返す', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: true }) });
    const gate = createRemotePasswordGate(lambda, 'accounts-function');
    await expect(gate(caller)).resolves.toBe(true);
    const call = lambdaMock.commandCalls(InvokeCommand)[0];
    expect(call?.args[0].input.FunctionName).toBe('accounts-function');
    const sentPayload = JSON.parse(
      Buffer.from(call?.args[0].input.Payload as Uint8Array).toString('utf8'),
    );
    expect(sentPayload).toEqual({
      kind: 'caller-status',
      caller: { sub: 'req-1', roles: ['requester'] },
    });
  });

  it('false も正しく返す', async () => {
    lambdaMock.on(InvokeCommand).resolves({ Payload: payload({ mustChangePassword: false }) });
    const gate = createRemotePasswordGate(lambda, 'accounts-function');
    await expect(gate(caller)).resolves.toBe(false);
  });
});
