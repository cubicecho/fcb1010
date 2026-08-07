import { createFileRoute } from '@tanstack/react-router';
import { DumpToolbar } from '@/components/fcb/DumpToolbar';
import { MidiNumberInput } from '@/components/fcb/MidiNumberInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const CHANNELS = Array.from({ length: 16 }, (_, i) => i);

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>MIDI channels</CardTitle>
          <CardDescription>Transmit channel for each of the ten MIDI functions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {MIDI_FUNCTIONS.map((fn) => (
            <div key={fn} className="flex items-center justify-between gap-4 border-b py-1.5 last:border-b-0">
              <Label htmlFor={`channel-${fn}`}>{FUNCTION_LABELS[fn]}</Label>
              <Select
                value={String(global.channels[fn])}
                onValueChange={(value) =>
                  apply((draft) => {
                    draft.channels[fn] = Number(value);
                  })
                }
              >
                <SelectTrigger id={`channel-${fn}`} size="sm" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((channel) => (
                    <SelectItem key={String(channel)} value={String(channel)}>
                      Ch {channel + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            <ToggleRow
              id="direct-select"
              label="Direct select"
              description="Pedals 1-10 switch presets immediately, without bank confirmation."
              checked={global.directSelect}
              onCheckedChange={(directSelect) =>
                apply((draft) => {
                  draft.directSelect = directSelect;
                })
              }
            />
            <ToggleRow
              id="running-status"
              label="Running status"
              description="Omit repeated MIDI status bytes to reduce traffic."
              checked={global.runningStatus}
              onCheckedChange={(runningStatus) =>
                apply((draft) => {
                  draft.runningStatus = runningStatus;
                })
              }
            />
            <ToggleRow
              id="midi-merge"
              label="MIDI merge"
              description="Forward messages arriving at MIDI IN to MIDI OUT."
              checked={global.midiMerge}
              onCheckedChange={(midiMerge) =>
                apply((draft) => {
                  draft.midiMerge = midiMerge;
                })
              }
            />
            <ToggleRow
              id="global-switch1"
              label="Switch 1"
              description="Global switch 1 configuration bit."
              checked={global.switch1}
              onCheckedChange={(switch1) =>
                apply((draft) => {
                  draft.switch1 = switch1;
                })
              }
            />
            <ToggleRow
              id="global-switch2"
              label="Switch 2"
              description="Global switch 2 configuration bit."
              checked={global.switch2}
              onCheckedChange={(switch2) =>
                apply((draft) => {
                  draft.switch2 = switch2;
                })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expression pedal calibration</CardTitle>
            <CardDescription>
              Raw min/max values captured by the pedal's calibration routine. Usually left as-is.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3">
            {(
              [
                ['Pedal A min', 'expACalibrationMin'],
                ['Pedal A max', 'expACalibrationMax'],
                ['Pedal B min', 'expBCalibrationMin'],
                ['Pedal B max', 'expBCalibrationMax'],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{label}</span>
                <MidiNumberInput
                  value={global[key]}
                  onChange={(value) =>
                    apply((draft) => {
                      draft[key] = value;
                    })
                  }
                  aria-label={label}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SetupPage() {
  const { dump } = useDump();

  return (
    <div className="flex flex-col gap-4">
      <DumpToolbar />
      {dump ? (
        <SetupEditor />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No dump loaded</CardTitle>
            <CardDescription>
              Global settings are part of the patchdump. Create a new setup, load a .syx file, or receive a dump from
              the pedal to edit them.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});
