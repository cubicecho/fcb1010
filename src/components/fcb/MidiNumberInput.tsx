import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MidiNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
  'aria-label'?: string;
}

/** Numeric input clamped to the MIDI 0-127 range. */
export function MidiNumberInput({
  value,
  onChange,
  disabled,
  min = 0,
  max = 127,
  className,
  'aria-label': ariaLabel,
}: MidiNumberInputProps) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn('h-8 w-18 text-sm', className)}
      onChange={(event) => {
        const parsed = Number.parseInt(event.target.value, 10);
        if (Number.isNaN(parsed)) return;
        onChange(Math.min(max, Math.max(min, parsed)));
      }}
    />
  );
}
