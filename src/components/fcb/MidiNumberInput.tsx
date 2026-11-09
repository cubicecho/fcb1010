import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type MidiNumberInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * Numeric input clamped to the MIDI 0-127 range. The rest of the props reach the `Input`, so a
 * `FormField` can hand it its `id` and the description's ids.
 */
export function MidiNumberInput({ value, onChange, min = 0, max = 127, className, ...props }: MidiNumberInputProps) {
  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      value={String(value)}
      min={min}
      max={max}
      className={cn('h-8 w-18 text-sm', className)}
      onChange={(event) => {
        const parsed = Number.parseInt(event.target.value, 10);
        if (Number.isNaN(parsed)) return;
        onChange(Math.min(max, Math.max(min, parsed)));
      }}
    />
  );
}
