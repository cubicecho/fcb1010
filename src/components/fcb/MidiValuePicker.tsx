import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => item.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn('h-8 w-44 justify-between px-2 text-sm font-normal', className)}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Number or name…" className="h-8" />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  keywords={item.keywords}
                  onSelect={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <Check className={cn('ml-auto size-3.5', item.value === value ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
