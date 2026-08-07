import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { FirmwareInfo } from './pack';

export interface DetectedFirmware {
  info: FirmwareInfo;
  /** ISO timestamp of the successful detection. */
  detectedAt: string;
}

interface FirmwareContextValue {
  /** Last successful firmware detection, persisted across sessions. */
  firmware: DetectedFirmware | null;
  setFirmware: (info: FirmwareInfo) => void;
  clearFirmware: () => void;
}

const FirmwareContext = createContext<FirmwareContextValue | null>(null);

const STORAGE_KEY = 'fcb1010:firmware';

function loadFromStorage(): DetectedFirmware | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as DetectedFirmware;
    if (typeof stored?.info?.firmware !== 'string' || typeof stored?.info?.version !== 'string') return null;
    return stored;
  } catch {
    return null;
  }
}

export function FirmwareProvider({ children }: { children: ReactNode }) {
  const [firmware, setFirmwareState] = useState<DetectedFirmware | null>(loadFromStorage);

  const setFirmware = useCallback((info: FirmwareInfo) => {
    const detected: DetectedFirmware = { info, detectedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(detected));
    setFirmwareState(detected);
  }, []);

  const clearFirmware = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setFirmwareState(null);
  }, []);

  const value = useMemo(() => ({ firmware, setFirmware, clearFirmware }), [firmware, setFirmware, clearFirmware]);

  return <FirmwareContext.Provider value={value}>{children}</FirmwareContext.Provider>;
}

export function useFirmware(): FirmwareContextValue {
  const context = useContext(FirmwareContext);
  if (!context) {
    throw new Error('useFirmware must be used within a FirmwareProvider');
  }
  return context;
}
