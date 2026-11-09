import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CardLayout } from '@/components/card-layout';
import { DumpToolbar } from '@/components/fcb/DumpToolbar';
import { NoDumpLoaded } from '@/components/fcb/NoDumpLoaded';
import { PresetEditor } from '@/components/fcb/PresetEditor';
import { PresetGrid } from '@/components/fcb/PresetGrid';
import { PageLayout } from '@/components/page-layout';
import { useDump } from '@/lib/fcb/DumpProvider';
import type { FcbPreset } from '@/lib/fcb/model';

function PresetsPage() {
  const { dump } = useDump();
  const [selected, setSelected] = useState(0);
  const [clipboard, setClipboard] = useState<FcbPreset | null>(null);

  return (
    <PageLayout
      title="Presets"
      headerContentSlot={<DumpToolbar />}
      contentSlot={
        dump ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <CardLayout
              level={2}
              title="Banks & presets"
              description="Pick a bank, then a pedal. Layout matches the board: 6-10 top, 1-5 bottom."
              contentSlot={<PresetGrid selected={selected} onSelect={setSelected} />}
            />
            <PresetEditor presetIndex={selected} clipboard={clipboard} onClipboardChange={setClipboard} />
          </div>
        ) : (
          <NoDumpLoaded />
        )
      }
    />
  );
}

export const Route = createFileRoute('/presets')({
  component: PresetsPage,
});
