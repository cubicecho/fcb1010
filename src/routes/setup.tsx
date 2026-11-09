import { createFileRoute } from '@tanstack/react-router';
import { CardLayout } from '@/components/card-layout';
import { Combobox } from '@/components/combobox';
import { DumpToolbar } from '@/components/fcb/DumpToolbar';
import { MidiNumberInput } from '@/components/fcb/MidiNumberInput';
import { NoDumpLoaded } from '@/components/fcb/NoDumpLoaded';
import { FormField } from '@/components/form-field';
import { PageLayout } from '@/components/page-layout';
import { SettingRow } from '@/components/setting-row';
import { Switch } from '@/components/ui/switch';
import { useDump } from '@/lib/fcb/DumpProvider';
import { type FcbGlobal, getGlobal, MIDI_FUNCTIONS, type MidiFunction, setGlobal } from '@/lib/fcb/model';

const FUNCTION_LABELS: Record<MidiFunction, string> = {
  pc1: 'Program change 1',
  pc2: 'Program change 2',
  pc3: 'Program change 3',
  pc4: 'Program change 4',
  pc5: 'Program change 5',
  cc1: 'Control change 1',
  cc2: 'Control change 2',
  expA: 'Expression A',
  expB: 'Expression B',
  note: 'Note',
};

const CHANNEL_OPTIONS = Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: `Ch ${i + 1}` }));

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      actionSlot={({ titleId, descriptionId }) => (
        <Switch
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      )}
    />
  );
}

function SetupEditor() {
  const { dump, updateMemory } = useDump();
  if (!dump) return null;

  const global = getGlobal(dump.memory);

  const apply = (change: (draft: FcbGlobal) => void) => {
    updateMemory((memory) => {
      const draft = getGlobal(memory);
      change(draft);
      setGlobal(memory, draft);
    });
  };

  const toggle = (key: 'directSelect' | 'runningStatus' | 'midiMerge' | 'switch1' | 'switch2') => (checked: boolean) =>
    apply((draft) => {
      draft[key] = checked;
    });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <CardLayout
        level={2}
        title="MIDI channels"
        description="Transmit channel for each of the ten MIDI functions."
        contentSlot={MIDI_FUNCTIONS.map((fn) => (
          <SettingRow
            key={fn}
            title={FUNCTION_LABELS[fn]}
            actionSlot={({ titleId }) => (
              <Combobox
                aria-labelledby={titleId}
                className="w-28"
                options={CHANNEL_OPTIONS}
                value={String(global.channels[fn])}
                onValueChange={(value: string) =>
                  apply((draft) => {
                    draft.channels[fn] = Number(value);
                  })
                }
              />
            )}
          />
        ))}
      />

      <div className="flex flex-col gap-4">
        <CardLayout
          level={2}
          title="Options"
          contentSlot={
            <>
              <ToggleRow
                title="Direct select"
                description="Pedals 1-10 switch presets immediately, without bank confirmation."
                checked={global.directSelect}
                onCheckedChange={toggle('directSelect')}
              />
              <ToggleRow
                title="Running status"
                description="Omit repeated MIDI status bytes to reduce traffic."
                checked={global.runningStatus}
                onCheckedChange={toggle('runningStatus')}
              />
              <ToggleRow
                title="MIDI merge"
                description="Forward messages arriving at MIDI IN to MIDI OUT."
                checked={global.midiMerge}
                onCheckedChange={toggle('midiMerge')}
              />
              <ToggleRow
                title="Switch 1"
                description="Global switch 1 configuration bit."
                checked={global.switch1}
                onCheckedChange={toggle('switch1')}
              />
              <ToggleRow
                title="Switch 2"
                description="Global switch 2 configuration bit."
                checked={global.switch2}
                onCheckedChange={toggle('switch2')}
              />
            </>
          }
        />

        <CardLayout
          level={2}
          title="Expression pedal calibration"
          description="Raw min/max values captured by the pedal's calibration routine. Usually left as-is."
          contentClassName="grid grid-cols-2 gap-x-6 gap-y-4"
          contentSlot={(
            [
              ['Pedal A min', 'expACalibrationMin'],
              ['Pedal A max', 'expACalibrationMax'],
              ['Pedal B min', 'expBCalibrationMin'],
              ['Pedal B max', 'expBCalibrationMax'],
            ] as const
          ).map(([label, key]) => (
            <FormField
              key={key}
              label={label}
              controlSlot={
                <MidiNumberInput
                  value={global[key]}
                  onChange={(value) =>
                    apply((draft) => {
                      draft[key] = value;
                    })
                  }
                />
              }
            />
          ))}
        />
      </div>
    </div>
  );
}

function SetupPage() {
  const { dump } = useDump();

  return (
    <PageLayout
      title="Setup"
      description="Global settings stored with the patchdump."
      headerContentSlot={<DumpToolbar />}
      contentSlot={dump ? <SetupEditor /> : <NoDumpLoaded />}
    />
  );
}

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});
