// SettingsForm の試験（BR9.2・AC6.4.3）
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm, validateSettingsForm } from './SettingsForm';

const initial = {
  duplicateDistanceMeters: 1000,
  duplicateWindowHours: 24,
  targetAreaNorth: 46,
  targetAreaSouth: 20,
  targetAreaEast: 154,
  targetAreaWest: 122,
};

describe('validateSettingsForm', () => {
  it('正しい値は問題なし', () => {
    expect(validateSettingsForm(initial)).toEqual({});
  });

  it('距離が0以下はエラー（AC6.4.3）', () => {
    expect(validateSettingsForm({ ...initial, duplicateDistanceMeters: 0 })).toHaveProperty(
      'duplicateDistanceMeters',
    );
  });

  it('北<=南はエラー', () => {
    expect(validateSettingsForm({ ...initial, targetAreaNorth: 10 })).toHaveProperty(
      'targetAreaNorth',
    );
  });
});

describe('SettingsForm', () => {
  it('保存するとonSubmitを呼ぶ', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm initial={initial} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByTestId('settings-save'));
    expect(onSubmit).toHaveBeenCalledWith(initial);
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
  });

  it('範囲外では保存できない', async () => {
    const onSubmit = vi.fn();
    render(
      <SettingsForm initial={{ ...initial, duplicateDistanceMeters: 0 }} onSubmit={onSubmit} />,
    );
    await userEvent.click(screen.getByTestId('settings-save'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('1 m 以上を入れてください')).toBeInTheDocument();
  });
});
