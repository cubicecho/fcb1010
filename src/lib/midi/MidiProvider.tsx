import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type MessageEvent as MidiMessageEvent, WebMidi } from 'webmidi';
import { decodeMidiMessage } from './decode';
import type { MonitorEntry } from './types';

export type MidiStatus = 'unsupported' | 'pending' | 'enabled' | 'error';

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export const ALL_INPUTS = 'all';
export const NO_OUTPUT = 'none';

interface MidiContextValue {
  status: MidiStatus;
  error: string | null;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  /** Port id or ALL_INPUTS. */
  selectedInputId: string;
  /** Port id or NO_OUTPUT. */
  selectedOutputId: string;
  setSelectedInputId: (id: string) => void;
  setSelectedOutputId: (id: string) => void;
  /** Subscribe to decoded messages from the selected input(s). Returns unsubscribe. */
  subscribe: (listener: (entry: MonitorEntry) => void) => () => void;
  /**
   * Send raw bytes to the selected output. Returns false when no output is
   * selected or the selected port is gone (unplugged / id changed since it
   * was saved) — callers must surface that instead of waiting on a reply.
   */
  send: (data: number[]) => boolean;
  retry: () => void;
}

const MidiContext = createContext<MidiContextValue | null>(null);

const INPUT_STORAGE_KEY = 'fcb1010:selected-input';
const OUTPUT_STORAGE_KEY = 'fcb1010:selected-output';

function portInfo(port: { id: string; name: string; manufacturer?: string }): MidiPortInfo {
  return { id: port.id, name: port.name, manufacturer: port.manufacturer ?? '' };
}

export function MidiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MidiStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [selectedInputId, setSelectedInputIdState] = useState<string>(
    () => localStorage.getItem(INPUT_STORAGE_KEY) ?? ALL_INPUTS,
  );
  const [selectedOutputId, setSelectedOutputIdState] = useState<string>(
    () => localStorage.getItem(OUTPUT_STORAGE_KEY) ?? NO_OUTPUT,
  );
  const [enableAttempt, setEnableAttempt] = useState(0);

  const selectedInputRef = useRef(selectedInputId);
  selectedInputRef.current = selectedInputId;

  const listenersRef = useRef(new Set<(entry: MonitorEntry) => void>());
  const entryIdRef = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: enableAttempt intentionally re-runs the enable flow for retry()
  useEffect(() => {
    if (!WebMidi.supported) {
      setStatus('unsupported');
      setError('Web MIDI is not supported in this browser. Use Chrome, Edge, or another Chromium-based browser.');
      return;
    }

    let disposed = false;

    const refreshPorts = () => {
      if (disposed) return;
      setInputs(WebMidi.inputs.map(portInfo));
      setOutputs(WebMidi.outputs.map(portInfo));
    };

    const onMessage = (event: MidiMessageEvent) => {
      const port = event.port;
      const selected = selectedInputRef.current;
      if (selected !== ALL_INPUTS && port.id !== selected) return;

      const entry: MonitorEntry = {
        id: ++entryIdRef.current,
        timestamp: event.timestamp,
        direction: 'in',
        portId: port.id,
        portName: port.name,
        message: decodeMidiMessage(Array.from(event.message.data)),
      };
      for (const listener of listenersRef.current) {
        listener(entry);
      }
    };

    const bindInputs = () => {
      for (const input of WebMidi.inputs) {
        input.removeListener('midimessage', onMessage);
        input.addListener('midimessage', onMessage);
      }
    };

    const onPortsChanged = () => {
      refreshPorts();
      bindInputs();
    };

    WebMidi.enable({ sysex: true })
      .then(() => {
        if (disposed) return;
        setStatus('enabled');
        setError(null);
        refreshPorts();
        bindInputs();
        WebMidi.addListener('connected', onPortsChanged);
        WebMidi.addListener('disconnected', onPortsChanged);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      disposed = true;
      WebMidi.removeListener('connected', onPortsChanged);
      WebMidi.removeListener('disconnected', onPortsChanged);
      for (const input of WebMidi.inputs) {
        input.removeListener('midimessage', onMessage);
      }
    };
  }, [enableAttempt]);

  const setSelectedInputId = useCallback((id: string) => {
    setSelectedInputIdState(id);
    localStorage.setItem(INPUT_STORAGE_KEY, id);
  }, []);

  const setSelectedOutputId = useCallback((id: string) => {
    setSelectedOutputIdState(id);
    localStorage.setItem(OUTPUT_STORAGE_KEY, id);
  }, []);

  const subscribe = useCallback((listener: (entry: MonitorEntry) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const send = useCallback(
    (data: number[]) => {
      if (selectedOutputId === NO_OUTPUT) return false;
      const output = WebMidi.outputs.find((candidate) => candidate.id === selectedOutputId);
      if (!output) return false;
      output.send(data);
      // Local echo so the Monitor shows what left the app and to which port —
      // without it, a message swallowed downstream is indistinguishable from
      // one that was never sent.
      const entry: MonitorEntry = {
        id: ++entryIdRef.current,
        timestamp: performance.now(),
        direction: 'out',
        portId: output.id,
        portName: output.name,
        message: decodeMidiMessage(data),
      };
      for (const listener of listenersRef.current) {
        listener(entry);
      }
      return true;
    },
    [selectedOutputId],
  );

  const retry = useCallback(() => {
    setStatus('pending');
    setError(null);
    setEnableAttempt((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      status,
      error,
      inputs,
      outputs,
      selectedInputId,
      selectedOutputId,
      setSelectedInputId,
      setSelectedOutputId,
      subscribe,
      send,
      retry,
    }),
    [
      status,
      error,
      inputs,
      outputs,
      selectedInputId,
      selectedOutputId,
      setSelectedInputId,
      setSelectedOutputId,
      subscribe,
      send,
      retry,
    ],
  );

  return <MidiContext.Provider value={value}>{children}</MidiContext.Provider>;
}

export function useMidi(): MidiContextValue {
  const context = useContext(MidiContext);
  if (!context) {
    throw new Error('useMidi must be used within a MidiProvider');
  }
  return context;
}
