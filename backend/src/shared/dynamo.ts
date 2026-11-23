// DynamoDB の共通の判定

/** 条件付きの書き込み・トランザクションの条件に合わなかった例外か */
export function isConditionFailure(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'ConditionalCheckFailedException' || err.name === 'TransactionCanceledException')
  );
}
