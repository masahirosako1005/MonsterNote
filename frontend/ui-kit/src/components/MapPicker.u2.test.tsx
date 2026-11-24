// 地図の部品の試験（BR2.11・BR2.16、NFR7.3: キーボードでの緯度・経度の直接入力を併設）。
// タイルの実際のネットワーク呼び出しは行わず、URL の組み立てだけを確かめる（unit-test-instructions）。
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { latLngToTile, MapPicker, tileUrl } from './MapPicker';

describe('latLngToTile / tileUrl', () => {
  it('緯度・経度からスリッピーマップのタイル座標を求める（ズーム 10 の東京付近）', () => {
    const tile = latLngToTile(35.6762, 139.6503, 10);
    expect(tile).toEqual({ x: 909, y: 403, z: 10 });
  });

  it('OpenStreetMap の公式タイルサーバーの URL を組み立てる（infrastructure-design Q1-A）', () => {
    expect(tileUrl(909, 403, 10)).toBe('https://tile.openstreetmap.org/10/909/403.png');
  });
});

describe('MapPicker', () => {
  it('キーボードで緯度・経度を直接入力できる（NFR7.3）', async () => {
    const onChange = vi.fn();
    render(<MapPicker value={{ lat: 35, lng: 135 }} onChange={onChange} />);
    const lat = screen.getByLabelText('緯度') as HTMLInputElement;
    await userEvent.clear(lat);
    await userEvent.type(lat, '36.5');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith({ lat: 36.5, lng: 135 });
  });

  it('対象地域の外を指すと警告を出す（BR2.16）', () => {
    render(
      <MapPicker
        value={{ lat: 10, lng: 135 }}
        onChange={vi.fn()}
        targetArea={{ north: 46, south: 20, east: 154, west: 122 }}
      />,
    );
    expect(screen.getByTestId('map-outside-area')).toHaveTextContent('対象地域の外です');
  });

  it('対象地域の中では警告を出さない', () => {
    render(
      <MapPicker
        value={{ lat: 35, lng: 135 }}
        onChange={vi.fn()}
        targetArea={{ north: 46, south: 20, east: 154, west: 122 }}
      />,
    );
    expect(screen.queryByTestId('map-outside-area')).not.toBeInTheDocument();
  });

  it('タイルの画像を並べて表示する（実際のネットワーク呼び出しはしない）', () => {
    render(<MapPicker value={{ lat: 35.6762, lng: 139.6503 }} onChange={vi.fn()} />);
    const tiles = screen.getAllByRole('img', { name: '地図' });
    expect(tiles.length).toBeGreaterThan(0);
    expect((tiles[0] as HTMLImageElement).src).toContain('tile.openstreetmap.org');
  });
});
