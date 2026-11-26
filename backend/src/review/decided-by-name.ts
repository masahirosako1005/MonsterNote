// 確認した人の名前（BR3.12）。
// 書き込み: ログインの証明に name があればそれ、無ければ既定値（利用者の ID をそのまま入れない）。
// 読み出し: 保存済みの値が利用者の ID の形（UUID）に見えたら既定値に置き換える（U1 の残り物の解消。レビュー R-02）。
export const DEFAULT_DECIDED_BY_NAME = '依頼元の担当者';

// 8-4-4-4-12 桁の英数字とハイフン（UUID の形）
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decidedByNameToWrite(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DECIDED_BY_NAME;
}

export function decidedByNameToRead(name: string | undefined): string | undefined {
  if (!name) return name;
  return UUID_LIKE.test(name) ? DEFAULT_DECIDED_BY_NAME : name;
}
