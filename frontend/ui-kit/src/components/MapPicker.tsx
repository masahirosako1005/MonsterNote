// 捕獲場所を地図で指す部品（BR2.11・BR2.16）。タイルは OpenStreetMap の公式サーバーから
// 画面が直接取得する（サーバーを経由しない。NFR5.12、infrastructure-design Q1-A）。
// キーボードでも緯度・経度を直接入力できる手段を併せて置く（NFR7.3）。
import { useId, type FocusEvent } from 'react';
import { Alert, Box, Stack, TextField, Typography } from '@mui/material';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TargetArea {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** 緯度・経度からスリッピーマップのタイル座標を求める（標準の式） */
export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number; z: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

/** OpenStreetMap の公式タイルサーバーの URL */
export function tileUrl(x: number, y: number, z: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function isWithinTargetArea(point: GeoPoint, area: TargetArea): boolean {
  return (
    point.lat >= area.south &&
    point.lat <= area.north &&
    point.lng >= area.west &&
    point.lng <= area.east
  );
}

const DEFAULT_ZOOM = 12;
/** 中心の周り 3x3 のタイルを並べる */
const GRID_OFFSETS = [-1, 0, 1];

export interface MapPickerProps {
  value?: GeoPoint;
  onChange: (point: GeoPoint) => void;
  targetArea?: TargetArea;
  zoom?: number;
}

export function MapPicker({ value, onChange, targetArea, zoom = DEFAULT_ZOOM }: MapPickerProps) {
  const latId = useId();
  const lngId = useId();
  const center = value ?? { lat: 35.6762, lng: 139.6503 };
  const { x, y, z } = latLngToTile(center.lat, center.lng, zoom);
  const outside = targetArea && value ? !isWithinTargetArea(value, targetArea) : false;

  const onNumberChange =
    (key: keyof GeoPoint) => (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const n = Number(e.target.value);
      if (!Number.isFinite(n)) return;
      onChange({ ...center, [key]: n });
    };

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          width: 240,
          height: 240,
          overflow: 'hidden',
        }}
        data-testid="map-tiles"
      >
        {GRID_OFFSETS.flatMap((dy) =>
          GRID_OFFSETS.map((dx) => (
            <img
              key={`${dx}-${dy}`}
              src={tileUrl(x + dx, y + dy, z)}
              alt="地図"
              width={80}
              height={80}
              loading="lazy"
            />
          )),
        )}
      </Box>
      {outside && (
        <Alert severity="warning" data-testid="map-outside-area" sx={{ mt: 1 }}>
          対象地域の外です
        </Alert>
      )}
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <TextField
          id={latId}
          label="緯度"
          type="number"
          slotProps={{ htmlInput: { step: 'any' } }}
          defaultValue={center.lat}
          onBlur={onNumberChange('lat')}
        />
        <TextField
          id={lngId}
          label="経度"
          type="number"
          slotProps={{ htmlInput: { step: 'any' } }}
          defaultValue={center.lng}
          onBlur={onNumberChange('lng')}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        地図が表示できないときは、緯度・経度を直接入力してください
      </Typography>
    </Box>
  );
}
