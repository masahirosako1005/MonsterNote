// 関数の環境変数（CDK が入れる。秘密でない値だけ。NFR6.2）。足りなければ起動のときに止める。
export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!value) throw new Error(`環境変数 ${name} がありません`);
  return value;
}
