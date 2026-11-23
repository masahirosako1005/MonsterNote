// 写真を撮る・選ぶ部品（H3。BR2.2: JPEG・PNG・HEIC で 15 MB まで。NFR2.4: 長辺 2,048 px に縮小）。
// 画面での確認は使いやすさのため。決まりはサーバーでも確かめる。
import { useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { MAX_EDGE_PX, resizeImage } from '../image/resize';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export interface PhotoPickerProps {
  onPicked: (photo: Blob) => void;
  resize?: (file: Blob, maxEdge: number) => Promise<Blob>;
  uploading?: boolean;
}

export function PhotoPicker({
  onPicked,
  resize = resizeImage,
  uploading = false,
}: PhotoPickerProps) {
  const [error, setError] = useState<string>();

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(undefined);
    if (!ACCEPTED.includes(file.type)) {
      setError('JPEG・PNG・HEIC の写真を選んでください');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('写真が大きすぎます。15 MB までの写真を選んでください');
      return;
    }
    try {
      onPicked(await resize(file, MAX_EDGE_PX));
    } catch {
      setError('写真を読めませんでした。別の写真を選んでください');
    }
  };

  return (
    <Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        component="label"
        variant="contained"
        fullWidth
        startIcon={<PhotoCameraIcon />}
        disabled={uploading}
        sx={{ mt: 2 }}
      >
        全身の写真を撮る・選ぶ
        <input
          hidden
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif"
          capture="environment"
          disabled={uploading}
          onChange={handleChange}
          data-testid="photo-input"
        />
      </Button>
      {uploading && (
        <Box sx={{ mt: 2 }} data-testid="photo-uploading">
          <Typography>写真を送っています</Typography>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );
}
