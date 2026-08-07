import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultMemory, PRESET_COUNT } from './model';
import { isFcbDump, packDump, unpackDump } from './pack';

export type DumpSource = 'file' | 'device' | 'default';

interface DumpState {
  memory: Uint8Array;
  deviceId: number;
  source: DumpSource;
  dirty: boolean;
}

interface DumpContextValue {
  /** Null until a dump is loaded or created. */
  dump: DumpState | null;
  /** Validate + load a raw 2352-byte sysex dump. Returns false if invalid. */
  loadDump: (bytes: readonly number[] | Uint8Array, source: DumpSource) => boolean;
  loadDefault: () => void;
  /** Apply an edit: mutator receives a copy of memory; marks the dump dirty. */
  updateMemory: (mutator: (memory: Uint8Array) => void) => void;
  /** Repack current memory as a sysex dump, or null if nothing loaded. */
  toSysex: () => Uint8Array | null;
  markClean: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** User labels for the 100 preset slots. Local to this browser, not part of the dump. */
  presetNames: readonly string[];
  setPresetName: (index: number, name: string) => void;
}

const DumpContext = createContext<DumpContextValue | null>(null);

const STORAGE_KEY = 'fcb1010:dump';
const NAMES_STORAGE_KEY = 'fcb1010:preset-names';
const HISTORY_LIMIT = 100;

interface StoredDump {
  base64: string;
  deviceId: number;
  source: DumpSource;
  dirty: boolean;
}

function saveToStorage(state: DumpState | null): void {
  if (!state) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const stored: StoredDump = {
    base64: btoa(String.fromCharCode(...state.memory)),
    deviceId: state.deviceId,
    source: state.source,
    dirty: state.dirty,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function loadFromStorage(): DumpState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDump;
    const memory = Uint8Array.from(atob(stored.base64), (c) => c.charCodeAt(0));
    return { memory, deviceId: stored.deviceId, source: stored.source, dirty: stored.dirty };
  } catch {
    return null;
  }
}

function loadNames(): string[] {
  try {
    const raw = localStorage.getItem(NAMES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      return Array.from({ length: PRESET_COUNT }, (_, i) => (typeof parsed[i] === 'string' ? parsed[i] : ''));
    }
  } catch {
    // fall through to empty names
  }
  return Array.from({ length: PRESET_COUNT }, () => '');
}

export function DumpProvider({ children }: { children: ReactNode }) {
  const [dump, setDump] = useState<DumpState | null>(loadFromStorage);
  const [presetNames, setPresetNames] = useState<string[]>(loadNames);
  // Memory snapshots for undo/redo. Loading a dump starts a fresh baseline.
  const undoStackRef = useRef<Uint8Array[]>([]);
  const redoStackRef = useRef<Uint8Array[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const resetHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const setAndPersist = useCallback(
    (next: DumpState | null) => {
      setDump(next);
      saveToStorage(next);
      resetHistory();
    },
    [resetHistory],
  );

  const loadDump = useCallback(
    (bytes: readonly number[] | Uint8Array, source: DumpSource) => {
      if (!isFcbDump(bytes)) return false;
      const memory = unpackDump(bytes);
      setAndPersist({ memory, deviceId: bytes[4], source, dirty: false });
      return true;
    },
    [setAndPersist],
  );

  const loadDefault = useCallback(() => {
    setAndPersist({ memory: createDefaultMemory(), deviceId: 0x01, source: 'default', dirty: false });
  }, [setAndPersist]);

  const updateMemory = useCallback((mutator: (memory: Uint8Array) => void) => {
    setDump((current) => {
      if (!current) return current;
      const memory = new Uint8Array(current.memory);
      mutator(memory);
      undoStackRef.current.push(current.memory);
      if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
      redoStackRef.current = [];
      setHistoryVersion((v) => v + 1);
      const next = { ...current, memory, dirty: true };
      saveToStorage(next);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setDump((current) => {
      const memory = undoStackRef.current.pop();
      if (!current || !memory) return current;
      redoStackRef.current.push(current.memory);
      setHistoryVersion((v) => v + 1);
      const next = { ...current, memory, dirty: true };
      saveToStorage(next);
      return next;
    });
  }, []);

  const redo = useCallback(() => {
    setDump((current) => {
      const memory = redoStackRef.current.pop();
      if (!current || !memory) return current;
      undoStackRef.current.push(current.memory);
      setHistoryVersion((v) => v + 1);
      const next = { ...current, memory, dirty: true };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setPresetName = useCallback((index: number, name: string) => {
    setPresetNames((current) => {
      const next = [...current];
      next[index] = name;
      localStorage.setItem(NAMES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y), skipping text fields so
  // native input undo keeps working.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const toSysex = useCallback(() => {
    if (!dump) return null;
    return packDump(dump.memory, dump.deviceId);
  }, [dump]);

  const markClean = useCallback(() => {
    setDump((current) => {
      if (!current) return current;
      const next = { ...current, dirty: false };
      saveToStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => setAndPersist(null), [setAndPersist]);

  // historyVersion ties canUndo/canRedo to the mutable stack refs.
  const canUndo = useMemo(() => historyVersion >= 0 && undoStackRef.current.length > 0, [historyVersion]);
  const canRedo = useMemo(() => historyVersion >= 0 && redoStackRef.current.length > 0, [historyVersion]);

  const value = useMemo(
    () => ({
      dump,
      loadDump,
      loadDefault,
      updateMemory,
      toSysex,
      markClean,
      clear,
      undo,
      redo,
      canUndo,
      canRedo,
      presetNames,
      setPresetName,
    }),
    [
      dump,
      loadDump,
      loadDefault,
      updateMemory,
      toSysex,
      markClean,
      clear,
      undo,
      redo,
      canUndo,
      canRedo,
      presetNames,
      setPresetName,
    ],
  );

  return <DumpContext.Provider value={value}>{children}</DumpContext.Provider>;
}

export function useDump(): DumpContextValue {
  const context = useContext(DumpContext);
  if (!context) {
    throw new Error('useDump must be used within a DumpProvider');
  }
  return context;
}
