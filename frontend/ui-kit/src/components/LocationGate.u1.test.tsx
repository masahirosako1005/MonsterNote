// LocationGate の試験（BR2.5: 位置の許可がないと送れない）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationGate } from './LocationGate';

describe('LocationGate', () => {
  it('位置が取れたら onLocation に渡し、「位置を確かめました」を表示する', async () => {
    const onLocation = vi.fn();
    render(
      <LocationGate
        getPosition={vi.fn().mockResolvedValue({ lat: 35, lng: 135 })}
        onLocation={onLocation}
      />,
    );
    expect(await screen.findByTestId('location-ok')).toHaveTextContent('位置を確かめました');
    expect(onLocation).toHaveBeenCalledWith({ lat: 35, lng: 135 });
  });

  it('許可がないと許可の手順を表示し、onLocation を呼ばない', async () => {
    const onLocation = vi.fn();
    render(
      <LocationGate
        getPosition={vi.fn().mockRejectedValue(new Error('denied'))}
        onLocation={onLocation}
      />,
    );
    expect(await screen.findByTestId('location-denied')).toHaveTextContent('位置情報の利用を許可');
    expect(onLocation).not.toHaveBeenCalled();
  });

  it('「もう一度」で取り直す', async () => {
    const getPosition = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValue({ lat: 1, lng: 2 });
    const onLocation = vi.fn();
    render(<LocationGate getPosition={getPosition} onLocation={onLocation} />);
    await userEvent.click(await screen.findByTestId('location-retry'));
    expect(await screen.findByTestId('location-ok')).toBeInTheDocument();
    expect(onLocation).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it('取っている間は「位置を確かめています」', () => {
    render(<LocationGate getPosition={() => new Promise(() => undefined)} onLocation={vi.fn()} />);
    expect(screen.getByTestId('location-pending')).toHaveTextContent('位置を確かめています');
  });
});
