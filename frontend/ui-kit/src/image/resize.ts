// 写真を長辺 2,048 px の JPEG に縮小する（NFR2.4。アップロードを軽くする）。ブラウザの canvas を使う。
export const MAX_EDGE_PX = 2048;

export async function resizeImage(file: Blob, maxEdge = MAX_EDGE_PX): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas を使えません');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('写真を変換できませんでした'))),
      'image/jpeg',
      0.85,
    );
  });
}
