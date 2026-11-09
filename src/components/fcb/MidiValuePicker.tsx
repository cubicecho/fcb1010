import { useMemo } from 'react';
import { Combobox } from '@/components/combobox';
import type { MidiPickerItem } from '@/lib/midi/names';
import { cn } from '@/lib/utils';

interface MidiValuePickerProps {
  value: number;
  onChange: (value: number) => void;
  items: readonly MidiPickerItem[];
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Searchable combobox over a fixed set of MIDI values (controllers, notes).
 * Type a number or a standard name ("volume", "c4") to filter.
 */
export function MidiValuePicker({
  value,
  onChange,
  items,
  disabled,
  className,
  'aria-label': ariaLabel,
}: MidiValuePickerProps) {
  const options = useMemo(
    () => items.map((item) => ({ value: String(item.value), label: item.label, keywords: item.keywords })),
    [items],
  );

  return (
    <Combobox
      searchable
      aria-label={ariaLabel}
      popoverLabel={ariaLabel}
      searchLabel={ariaLabel ? `Search ${ariaLabel}` : 'Search'}
      searchPlaceholder="Number or name…"
      emptyMessage="No match."
      disabled={disabled}
      className={cn('w-44', className)}
      options={options}
      value={String(value)}
      onValueChange={(next: string) => onChange(Number(next))}
    />
  );
}
