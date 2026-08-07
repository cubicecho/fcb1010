import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { DumpToolbar } from '@/components/fcb/DumpToolbar';
import { PresetEditor } from '@/components/fcb/PresetEditor';
import { PresetGrid } from '@/components/fcb/PresetGrid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDump } from '@/lib/fcb/DumpProvider';

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No dump loaded</CardTitle>
        <CardDescription>
          Start editing by creating a new setup (<span className="font-medium">New</span>), opening a saved{' '}
          <span className="font-medium">.syx</span> file, or receiving a patchdump from the pedal: connect the FCB1010
          via MIDI, select its input on the Monitor page, then trigger a dump from the pedal (hold DOWN while powering
          on, press UP/ENTER to reach the sysex send function).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function PresetsPage() {
  const { dump } = useDump();
  const [selected, setSelected] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <DumpToolbar />
      {dump ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Banks &amp; presets</CardTitle>
              <CardDescription>
                Pick a bank, then a pedal. Layout matches the board: 6-10 top, 1-5 bottom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PresetGrid selected={selected} onSelect={setSelected} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <PresetEditor presetIndex={selected} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

export const Route = createFileRoute('/presets')({
  component: PresetsPage,
});
