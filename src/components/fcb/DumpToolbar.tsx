import { Download, FilePlus2, FolderOpen, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDump } from '@/lib/fcb/DumpProvider';
import { isFcbDump } from '@/lib/fcb/pack';
import { NO_OUTPUT, useMidi } from '@/lib/midi/MidiProvider';

const SOURCE_LABELS = { file: 'from file', device: 'from pedal', default: 'new setup' } as const;

/**
 * Load / save / transfer actions for the current dump. Also listens for
 * incoming patchdumps on the selected MIDI input and offers to load them.
 */
export function DumpToolbar() {
  const { dump, loadDump, loadDefault, toSysex, markClean } = useDump();
  const midi = useMidi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [received, setReceived] = useState<{ bytes: number[]; portName: string } | null>(null);
  const [sendState, setSendState] = useState<'idle' | 'sent'>('idle');

  useEffect(() => {
    return midi.subscribe((entry) => {
      if (entry.message.kind !== 'sysex') return;
      if (!isFcbDump(entry.message.data)) return;
      setReceived({ bytes: [...entry.message.data], portName: entry.portName });
    });
  }, [midi.subscribe]);

  const openFile = () => fileInputRef.current?.click();

  const onFileChosen: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!loadDump(bytes, 'file')) {
      alert(`"${file.name}" is not a valid FCB1010 patchdump (expected 2352-byte sysex).`);
    }
  };

  const saveFile = () => {
    const sysex = toSysex();
    if (!sysex) return;
    const blob = new Blob([sysex.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fcb1010-uno.syx';
    link.click();
    URL.revokeObjectURL(url);
    markClean();
  };

  const sendToPedal = () => {
    const sysex = toSysex();
    if (!sysex) return;
    midi.send(Array.from(sysex));
    setSendState('sent');
    setTimeout(() => setSendState('idle'), 2500);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={loadDefault}>
          <FilePlus2 />
          New
        </Button>
        <Button variant="outline" size="sm" onClick={openFile}>
          <FolderOpen />
          Load .syx
        </Button>
        <Button variant="outline" size="sm" onClick={saveFile} disabled={!dump}>
          <Download />
          Save .syx
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={sendToPedal}
          disabled={!dump || midi.selectedOutputId === NO_OUTPUT}
          title={midi.selectedOutputId === NO_OUTPUT ? 'Select a MIDI output first' : undefined}
        >
          <Send />
          {sendState === 'sent' ? 'Sent!' : 'Send to pedal'}
        </Button>
        {dump && (
          <Badge variant={dump.dirty ? 'default' : 'secondary'} className="ml-auto">
            {dump.dirty ? 'unsaved changes' : 'saved'} · {SOURCE_LABELS[dump.source]}
          </Badge>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept=".syx,audio/midi" hidden onChange={onFileChosen} />

      {received && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/50 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Patchdump received from <span className="font-medium">{received.portName}</span>.
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                loadDump(received.bytes, 'device');
                setReceived(null);
              }}
            >
              Load it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReceived(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
