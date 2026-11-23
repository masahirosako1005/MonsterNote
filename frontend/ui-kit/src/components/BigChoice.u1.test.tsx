// BigChoice の試験（BR2.4、radiogroup の大きな選択肢）。「選ぶまで次へ不可」は種類と雌雄の画面の試験で確かめる
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BigChoice } from './BigChoice';
import { SPECIES_OPTIONS } from '../labels';

describe('BigChoice', () => {
  it('radiogroup と、選択肢ごとの radio を出す', () => {
    render(
      <BigChoice
        label="種類"
        name="species"
        options={SPECIES_OPTIONS}
        value={undefined}
        onChange={() => undefined}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: '種類' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'クマ',
      'イノシシ',
      'シカ',
    ]);
  });

  it('押すと onChange に値を渡す', async () => {
    const onChange = vi.fn();
    render(
      <BigChoice
        label="種類"
        name="species"
        options={SPECIES_OPTIONS}
        value={undefined}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId('species-boar'));
    expect(onChange).toHaveBeenCalledWith('boar');
  });

  it('選んだものは aria-checked=true、ほかは false', () => {
    render(
      <BigChoice
        label="種類"
        name="species"
        options={SPECIES_OPTIONS}
        value="deer"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('species-deer')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('species-bear')).toHaveAttribute('aria-checked', 'false');
  });

  it('選ぶまでは、どれも選ばれていない', () => {
    render(
      <BigChoice
        label="雌雄"
        name="sex"
        options={[{ value: 'male', label: 'オス' }]}
        value={undefined}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('sex-male')).toHaveAttribute('aria-checked', 'false');
  });
});
