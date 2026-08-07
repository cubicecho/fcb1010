import { Download, FilePlus2, FolderOpen, HardDriveDownload, Search, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDump } from '@/lib/fcb/DumpProvider';
import {
  dumpRequestMessage,
  type FirmwareInfo,
  isFcbDump,
  parseVersionResponse,
  versionRequestMessage,
} from '@/lib/fcb/pack';
import { NO_OUTPUT, useMidi } from '@/lib/midi/MidiProvider';

const SOURCE_LABELS = { file: 'from file', device: 'from pedal', default: 'new setup' } as const;

/** ControlCenter waits 30s for a requested patchdump. */
const RECEIVE_TIMEOUT_MS = 30000;
/** ControlCenter waits 5s for a version reply before assuming stock firmware. */
const VERSION_TIMEOUT_MS = 5000;

/**
 * Load / save / transfer actions for the current dump. "Receive from pedal"
 * sends a patchdump upload request (answered by UnO firmware); dumps that
 * arrive unsolicited (e.g. via the manual foot-switch procedure) show a
 * banner offering to load them.
 */
export function DumpToolbar() {
  const { dump, loadDump, loadDefault, toSysex, markClean } = useDump();
  const midi = useMidi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [received, setReceived] = useState<{ bytes: number[]; portName: string } | null>(null);
  const [sendState, setSendState] = useState<'idle' | 'sent'>('idle');
  const [receiveState, setReceiveState] = useState<'idle' | 'waiting' | 'timeout'>('idle');
  const [firmware, setFirmware] = useState<FirmwareInfo | 'detecting' | 'unknown' | null>(null);
  const waitingRef = useRef(false);
  const receiveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detectingRef = useRef(false);
  const versionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return midi.subscribe((entry) => {
      if (entry.message.kind !== 'sysex') return;
      if (detectingRef.current) {
        const info = parseVersionResponse(entry.message.data);
        if (info) {
          detectingRef.current = false;
          clearTimeout(versionTimerRef.current);
          setFirmware(info);
        }
      }
      if (!isFcbDump(entry.message.data)) return;
      if (waitingRef.current) {
        // We asked for this dump — load it directly.
        waitingRef.current = false;
        clearTimeout(receiveTimerRef.current);
        setReceiveState('idle');
        loadDump(entry.message.data, 'device');
        return;
      }
      setReceived({ bytes: [...entry.message.data], portName: entry.portName });
    });
  }, [midi.subscribe, loadDump]);

  useEffect(() => {
    return () => {
      clearTimeout(receiveTimerRef.current);
      clearTimeout(versionTimerRef.current);
    };
  }, []);

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

  const receiveFromPedal = () => {
    if (dump?.dirty && !confirm('You have unsaved changes that will be replaced by the pedal’s setup. Continue?')) {
      return;
    }
    midi.send(dumpRequestMessage(dump?.deviceId));
    waitingRef.current = true;
    setReceiveState('waiting');
    clearTimeout(receiveTimerRef.current);
    receiveTimerRef.current = setTimeout(() => {
      waitingRef.current = false;
      setReceiveState('timeout');
    }, RECEIVE_TIMEOUT_MS);
  };

  const detectFirmware = () => {
    midi.send(versionRequestMessage(dump?.deviceId));
    detectingRef.current = true;
    setFirmware('detecting');
    clearTimeout(versionTimerRef.current);
    versionTimerRef.current = setTimeout(() => {
      detectingRef.current = false;
      setFirmware('unknown');
    }, VERSION_TIMEOUT_MS);
  };

  const noOutput = midi.selectedOutputId === NO_OUTPUT;

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
          onClick={receiveFromPedal}
          disabled={noOutput || receiveState === 'waiting'}
          title={noOutput ? 'Select a MIDI output first (the request is sent to the pedal)' : undefined}
        >
          <HardDriveDownload />
          {receiveState === 'waiting' ? 'Waiting for pedal…' : 'Receive from pedal'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={sendToPedal}
          disabled={!dump || noOutput}
          title={noOutput ? 'Select a MIDI output first' : undefined}
        >
          <Send />
          {sendState === 'sent' ? 'Sent!' : 'Send to pedal'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={detectFirmware}
          disabled={noOutput || firmware === 'detecting'}
          title={noOutput ? 'Select a MIDI output first' : 'Ask the pedal which firmware it runs'}
        >
          <Search />
          {firmware === 'detecting' ? 'Detecting…' : 'Detect firmware'}
        </Button>
        {firmware !== null && firmware !== 'detecting' && (
          <Badge variant={firmware === 'unknown' ? 'outline' : 'secondary'}>
            {firmware === 'unknown' ? 'no reply — check MIDI in+out' : `${firmware.firmware} v${firmware.version}`}
          </Badge>
        )}
        {dump && (
          <Badge variant={dump.dirty ? 'default' : 'secondary'} className="ml-auto">
            {dump.dirty ? 'unsaved changes' : 'saved'} · {SOURCE_LABELS[dump.source]}
          </Badge>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept=".syx,audio/midi" hidden onChange={onFileChosen} />

      {receiveState === 'timeout' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm">
          <span>
            No patchdump received. Check that both MIDI input and output are connected to the pedal (try{' '}
            <span className="font-medium">Detect firmware</span> to verify the link). Manual fallback: power the pedal
            on holding <span className="font-medium">DOWN</span>, press <span className="font-medium">UP</span> until
            the CONFIG row is lit, then press footswitch <span className="font-medium">6</span> to transmit — the dump
            will be picked up here.
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setReceiveState('idle')}>
            Dismiss
          </Button>
        </div>
      )}

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
