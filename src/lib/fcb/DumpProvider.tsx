import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { createDefaultMemory } from './model';
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
}

const DumpContext = createContext<DumpContextValue | null>(null);

const STORAGE_KEY = 'fcb1010:dump';

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

export function DumpProvider({ children }: { children: ReactNode }) {
  const [dump, setDump] = useState<DumpState | null>(loadFromStorage);

  const setAndPersist = useCallback((next: DumpState | null) => {
    setDump(next);
    saveToStorage(next);
  }, []);

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
      const next = { ...current, memory, dirty: true };
      saveToStorage(next);
      return next;
    });
  }, []);

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

  const value = useMemo(
    () => ({ dump, loadDump, loadDefault, updateMemory, toSysex, markClean, clear }),
    [dump, loadDump, loadDefault, updateMemory, toSysex, markClean, clear],
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
