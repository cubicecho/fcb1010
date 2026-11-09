import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDump } from '@/lib/fcb/DumpProvider';
import { BANK_COUNT, type FcbPreset, getPreset, PRESETS_PER_BANK } from '@/lib/fcb/model';
import { CC_NAMES, noteName } from '@/lib/midi/names';
import { cn } from '@/lib/utils';

/** "CC 7 Volume" when the controller has a standard name, else "CC 27". */
function ccTag(controller: number): string {
  const name = CC_NAMES[controller];
  return name ? `CC ${controller} ${name}` : `CC ${controller}`;
}

function presetSummary(preset: FcbPreset): string {
  const tags: string[] = [];
  const enabledPc = preset.pc.filter((slot) => slot.enabled);
  if (enabledPc.length === 1) tags.push(`PC ${enabledPc[0].program}`);
  if (enabledPc.length > 1) tags.push(`${enabledPc.length}×PC`);
  if (preset.cc1.enabled) tags.push(ccTag(preset.cc1.controller));
  if (preset.cc2.enabled) tags.push(ccTag(preset.cc2.controller));
  if (preset.expA.enabled) tags.push('ExpA');
  if (preset.expB.enabled) tags.push('ExpB');
  if (preset.note.enabled) tags.push(`Note ${noteName(preset.note.value)}`);
  return tags.length > 0 ? tags.join(' · ') : 'empty';
}

interface PresetGridProps {
  selected: number;
  onSelect: (index: number) => void;
}

/**
 * Bank tabs plus a 2×5 pedal grid mirroring the physical FCB1010 layout
 * (pedals 6-10 on the top row, 1-5 on the bottom row).
 */
export function PresetGrid({ selected, onSelect }: PresetGridProps) {
  const { dump, presetNames } = useDump();
  const [bank, setBank] = useState(() => Math.floor(selected / PRESETS_PER_BANK));
  if (!dump) return null;

  const pedalButton = (pedal: number) => {
    const index = bank * PRESETS_PER_BANK + pedal;
    const preset = getPreset(dump.memory, index);
    const isSelected = index === selected;
    const name = presetNames[index];
    return (
      <button
        key={index}
        type="button"
        onClick={() => onSelect(index)}
        aria-pressed={isSelected}
        className={cn(
          'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none',
          isSelected
            ? 'border-active bg-active/40 hover:bg-active/60'
            : 'border-foreground/10 hover:bg-hover focus-visible:bg-hover',
        )}
      >
        <span className="flex w-full items-baseline gap-1.5 text-sm font-semibold">
          {pedal + 1}
          {name && <span className="truncate font-normal">{name}</span>}
        </span>
        <span className="w-full truncate text-xs text-foreground/60">{presetSummary(preset)}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={String(bank)} onValueChange={(value) => setBank(Number(value))}>
        <TabsList className="w-full">
          {Array.from({ length: BANK_COUNT }, (_, b) => (
            <TabsTrigger key={String(b)} value={String(b)}>
              {String(b).padStart(2, '0')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-5 gap-2">
        {[5, 6, 7, 8, 9].map(pedalButton)}
        {[0, 1, 2, 3, 4].map(pedalButton)}
      </div>
    </div>
  );
}
