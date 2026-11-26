// PhotoPicker の試験（BR2.2: 形式と 15 MB、NFR2.4: 長辺 2,048 px の縮小を呼ぶ）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoPicker } from './PhotoPicker';

const file = (type: string, size = 1000, name = 'a.jpg') => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('PhotoPicker', () => {
  it('JPEG を選ぶと長辺 2,048 px に縮小して onPicked に渡す', async () => {
    const resized = new Blob(['small'], { type: 'image/jpeg' });
    const resize = vi.fn().mockResolvedValue(resized);
    const onPicked = vi.fn();
    render(<PhotoPicker onPicked={onPicked} resize={resize} />);
    await userEvent.upload(screen.getByTestId('photo-input'), file('image/jpeg'));
    expect(resize).toHaveBeenCalledWith(expect.any(File), 2048);
    expect(onPicked).toHaveBeenCalledWith(resized);
  });

  it('許されない形式は「JPEG・PNG・HEIC の写真を選んでください」で、onPicked を呼ばない', async () => {
    const onPicked = vi.fn();
    render(<PhotoPicker onPicked={onPicked} resize={vi.fn()} />);
    await userEvent.upload(screen.getByTestId('photo-input'), file('image/gif', 10, 'a.gif'), {
      applyAccept: false,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG・PNG・HEIC');
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('15 MB を超える写真は選べない', async () => {
    const onPicked = vi.fn();
    render(<PhotoPicker onPicked={onPicked} resize={vi.fn()} />);
    await userEvent.upload(
      screen.getByTestId('photo-input'),
      file('image/png', 15 * 1024 * 1024 + 1),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('15 MB');
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('縮小に失敗したら知らせる', async () => {
    const onPicked = vi.fn();
    render(<PhotoPicker onPicked={onPicked} resize={vi.fn().mockRejectedValue(new Error('x'))} />);
    await userEvent.upload(screen.getByTestId('photo-input'), file('image/heic', 100, 'a.heic'));
    expect(await screen.findByRole('alert')).toHaveTextContent('写真を読めませんでした');
  });

  it('capture属性を付けない（OSのネイティブピッカーで「撮る」「選ぶ」の両方を出すため）', () => {
    render(<PhotoPicker onPicked={vi.fn()} resize={vi.fn()} />);
    expect(screen.getByTestId('photo-input')).not.toHaveAttribute('capture');
  });

  it('アップロード中は進み具合を表示し、撮り直せない', () => {
    render(<PhotoPicker onPicked={vi.fn()} resize={vi.fn()} uploading />);
    expect(screen.getByTestId('photo-uploading')).toHaveTextContent('写真を送っています');
    expect(screen.getByTestId('photo-input')).toBeDisabled();
  });
});
