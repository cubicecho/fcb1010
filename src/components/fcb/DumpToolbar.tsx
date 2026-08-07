import { Download, FilePlus2, FolderOpen, HardDriveDownload, Redo2, Search, Send, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDump } from '@/lib/fcb/DumpProvider';
import { useFirmware } from '@/lib/fcb/FirmwareProvider';
import {
  dumpRequestMessage,
  type FirmwareInfo,
  isFcbDump,
  parseVersionResponse,
  unpackDump,
  versionRequestMessage,
} from '@/lib/fcb/pack';
import { toHex } from '@/lib/midi/decode';
import { NO_OUTPUT, useMidi } from '@/lib/midi/MidiProvider';

const SOURCE_LABELS = { file: 'from file', device: 'from pedal', default: 'new setup' } as const;

/** ControlCenter waits 30s for a requested patchdump. */
const RECEIVE_TIMEOUT_MS = 30000;
/** ControlCenter waits 5s for a version reply before assuming stock firmware. */
const VERSION_TIMEOUT_MS = 5000;
/** Pause after sending a dump before requesting the readback, so the pedal finishes storing it. */
const VERIFY_DELAY_MS = 3000;

type VerifyState = 'idle' | 'verifying' | 'verified' | 'mismatch' | 'unverified';

type DetectState =
  | null
  | 'detecting'
  | { kind: 'ok'; info: FirmwareInfo }
  /** Nothing came back at all — no working two-way MIDI link. */
  | { kind: 'silent' }
  /** Sysex arrived during the detect window but was not a version reply. */
  | { kind: 'unrecognized'; hex: string };

/**
 * Load / save / transfer actions for the current dump. "Receive from pedal"
 * sends a patchdump upload request (answered by UnO firmware); dumps that
 * arrive unsolicited (e.g. via the manual foot-switch procedure) show a
 * banner offering to load them.
 */
export function DumpToolbar() {
  const { dump, loadDump, loadDefault, toSysex, markClean, undo, redo, canUndo, canRedo } = useDump();
  const { setFirmware } = useFirmware();
  const midi = useMidi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [received, setReceived] = useState<{ bytes: number[]; portName: string } | null>(null);
  const [receiveState, setReceiveState] = useState<'idle' | 'waiting' | 'timeout' | 'sendfailed'>('idle');
  const [detectState, setDetectState] = useState<DetectState>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const waitingRef = useRef(false);
  const receiveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detectingRef = useRef(false);
  /** Sysex seen while detecting that was not a version reply (for diagnostics). */
  const strayReplyRef = useRef<readonly number[] | null>(null);
  const versionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** The memory we just sent, while waiting on the verification readback. */
  const verifyingRef = useRef<Uint8Array | null>(null);
  const verifyDelayRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return midi.subscribe((entry) => {
      if (entry.direction === 'out' || entry.message.kind !== 'sysex') return;
      if (detectingRef.current) {
        const info = parseVersionResponse(entry.message.data);
        if (info) {
          detectingRef.current = false;
          clearTimeout(versionTimerRef.current);
          setDetectState({ kind: 'ok', info });
          setFirmware(info);
        } else {
          strayReplyRef.current = entry.message.data;
        }
      }
      if (!isFcbDump(entry.message.data)) return;
      if (verifyingRef.current) {
        // Readback after "Send to pedal" — compare, don't load.
        const sent = verifyingRef.current;
        verifyingRef.current = null;
        clearTimeout(verifyTimerRef.current);
        const readback = unpackDump(entry.message.data);
        const matches = readback.length === sent.length && readback.every((byte, i) => byte === sent[i]);
        setVerifyState(matches ? 'verified' : 'mismatch');
        if (matches) markClean();
        return;
      }
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
  }, [midi.subscribe, loadDump, markClean, setFirmware]);

  useEffect(() => {
    return () => {
      clearTimeout(receiveTimerRef.current);
      clearTimeout(versionTimerRef.current);
      clearTimeout(verifyDelayRef.current);
      clearTimeout(verifyTimerRef.current);
    };
  }, []);

  const confirmDiscard = () => !dump?.dirty || confirm('You have unsaved changes that will be lost. Continue?');

  const newSetup = () => {
    if (confirmDiscard()) loadDefault();
  };

  const openFile = () => {
    if (confirmDiscard()) fileInputRef.current?.click();
  };

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
    link.download = `fcb1010-${new Date().toISOString().slice(0, 10)}.syx`;
    link.click();
    URL.revokeObjectURL(url);
    markClean();
  };

  const sendToPedal = () => {
    const sysex = toSysex();
    if (!dump || !sysex) return;
    if (!confirm('Send this setup to the pedal? It overwrites all 100 presets and global settings stored on it.')) {
      return;
    }
    if (!midi.send(Array.from(sysex))) {
      setReceiveState('sendfailed');
      return;
    }
    const sentMemory = new Uint8Array(dump.memory);
    setVerifyState('verifying');
    verifyingRef.current = null;
    clearTimeout(verifyDelayRef.current);
    clearTimeout(verifyTimerRef.current);
    // Give the pedal time to store the dump, then read it back and compare.
    verifyDelayRef.current = setTimeout(() => {
      verifyingRef.current = sentMemory;
      if (!midi.send(dumpRequestMessage(dump.deviceId))) {
        verifyingRef.current = null;
        setVerifyState('unverified');
        return;
      }
      verifyTimerRef.current = setTimeout(() => {
        verifyingRef.current = null;
        setVerifyState('unverified');
      }, RECEIVE_TIMEOUT_MS);
    }, VERIFY_DELAY_MS);
  };

  const receiveFromPedal = () => {
    if (dump?.dirty && !confirm('You have unsaved changes that will be replaced by the pedal’s setup. Continue?')) {
      return;
    }
    if (!midi.send(dumpRequestMessage(dump?.deviceId))) {
      setReceiveState('sendfailed');
      return;
    }
    waitingRef.current = true;
    setReceiveState('waiting');
    clearTimeout(receiveTimerRef.current);
    receiveTimerRef.current = setTimeout(() => {
      waitingRef.current = false;
      setReceiveState('timeout');
    }, RECEIVE_TIMEOUT_MS);
  };

  const detectFirmware = () => {
    if (!midi.send(versionRequestMessage(dump?.deviceId))) {
      setReceiveState('sendfailed');
      return;
    }
    detectingRef.current = true;
    strayReplyRef.current = null;
    setDetectState('detecting');
    clearTimeout(versionTimerRef.current);
    versionTimerRef.current = setTimeout(() => {
      detectingRef.current = false;
      const stray = strayReplyRef.current;
      setDetectState(stray ? { kind: 'unrecognized', hex: toHex([...stray]) } : { kind: 'silent' });
    }, VERSION_TIMEOUT_MS);
  };

  const noOutput = midi.selectedOutputId === NO_OUTPUT;
  // The saved output id can go stale (unplugged, or the OS re-enumerated the
  // port under a new id) — the button would otherwise "send" into the void.
  const outputMissing = !noOutput && !midi.outputs.some((output) => output.id === midi.selectedOutputId);
  const outputUnavailable = noOutput || outputMissing;
  const outputHint = noOutput
    ? 'Select a MIDI output first (the request is sent to the pedal)'
    : outputMissing
      ? 'The selected MIDI output is no longer connected — re-select it on the Monitor page'
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={newSetup}>
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
        <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Undo2 />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={receiveFromPedal}
          disabled={outputUnavailable || receiveState === 'waiting'}
          title={outputHint}
        >
          <HardDriveDownload />
          {receiveState === 'waiting' ? 'Waiting for pedal…' : 'Receive from pedal'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={sendToPedal}
          disabled={!dump || outputUnavailable || verifyState === 'verifying'}
          title={outputHint}
        >
          <Send />
          {verifyState === 'verifying' ? 'Verifying…' : 'Send to pedal'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={detectFirmware}
          disabled={outputUnavailable || detectState === 'detecting'}
          title={outputHint ?? 'Ask the pedal which firmware it runs'}
        >
          <Search />
          {detectState === 'detecting' ? 'Detecting…' : 'Detect firmware'}
        </Button>
        {detectState !== null && detectState !== 'detecting' && (
          <Badge variant={detectState.kind === 'ok' ? 'secondary' : 'outline'}>
            {detectState.kind === 'ok'
              ? `${detectState.info.firmware} v${detectState.info.version}`
              : detectState.kind === 'unrecognized'
                ? `unrecognized reply: ${detectState.hex}`
                : 'no reply — check MIDI in+out'}
          </Badge>
        )}
        {dump && (
          <Badge variant={dump.dirty ? 'default' : 'secondary'} className="ml-auto">
            {dump.dirty ? 'unsaved changes' : 'saved'} · {SOURCE_LABELS[dump.source]}
          </Badge>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept=".syx,audio/midi" hidden onChange={onFileChosen} />

      {receiveState === 'sendfailed' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm">
          <span>
            Nothing was sent — the selected MIDI output is no longer available (unplugged, or its id changed). Re-select
            the output on the <span className="font-medium">Monitor</span> page and try again.
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setReceiveState('idle')}>
            Dismiss
          </Button>
        </div>
      )}

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

      {verifyState === 'verified' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/50 bg-primary/5 px-3 py-2 text-sm">
          <span>Sent and verified — the pedal's memory matches this setup.</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setVerifyState('idle')}>
            Dismiss
          </Button>
        </div>
      )}

      {verifyState === 'mismatch' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm">
          <span>
            The pedal's memory does <span className="font-medium">not</span> match what was sent. Try sending again; if
            it keeps happening, the MIDI link may be corrupting sysex (some USB interfaces drop or mangle large
            messages).
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setVerifyState('idle')}>
            Dismiss
          </Button>
        </div>
      )}

      {verifyState === 'unverified' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <span>
            Setup sent, but the pedal didn't answer the verification readback. On stock (non-UnO) firmware the pedal
            can't send its memory on request, so the send may still have worked — check a preset on the pedal to
            confirm.
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setVerifyState('idle')}>
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
