// 大きな選択肢（種類・雌雄。BR2.4）。radiogroup として読み上げられる。
import { Box, Button, Typography } from '@mui/material';
import { useId } from 'react';
import type { ChoiceOption } from '../labels';

export interface BigChoiceProps<T extends string> {
  label: string;
  name: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

export function BigChoice<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: BigChoiceProps<T>) {
  const labelId = useId();
  return (
    <Box sx={{ mb: 3 }}>
      <Typography id={labelId} component="h2" variant="h6" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box
        role="radiogroup"
        aria-labelledby={labelId}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, 1fr)`,
          gap: 1,
        }}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Button
              key={option.value}
              role="radio"
              aria-checked={checked}
              variant={checked ? 'contained' : 'outlined'}
              onClick={() => onChange(option.value)}
              data-testid={`${name}-${option.value}`}
            >
              {option.label}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
