import { describe, expect, it } from 'vitest';
import { createDefaultMemory, getGlobal, getPreset, presetLabel, setGlobal, setPreset } from './model';
import {
  DUMP_SIZE,
  dumpRequestMessage,
  HEADER,
  isFcbDump,
  MEMORY_SIZE,
  packDump,
  parseVersionResponse,
  unpackDump,
  versionRequestMessage,
} from './pack';

/** A deterministic pseudo-random full dump exercising every bit position. */
function syntheticDump(): Uint8Array {
  const dump = new Uint8Array(DUMP_SIZE);
  dump.set(HEADER);
  let seed = 1;
  for (let i = HEADER.length; i < DUMP_SIZE - 1; i++) {
    seed = (seed * 75 + 74) % 65537;
    dump[i] = seed & 0x7f;
  }
  dump[DUMP_SIZE - 1] = 0xf7;
  return dump;
}

describe('isFcbDump', () => {
  it('accepts a well-formed dump and any device id', () => {
    const dump = syntheticDump();
    expect(isFcbDump(dump)).toBe(true);
    dump[4] = 0x00;
    expect(isFcbDump(dump)).toBe(true);
  });

  it('rejects wrong sizes and headers', () => {
    expect(isFcbDump(new Uint8Array(100))).toBe(false);
    const dump = syntheticDump();
    dump[5] = 0x0d;
    expect(isFcbDump(dump)).toBe(false);
  });
});

describe('request messages', () => {
  it('dump request uses function 0x4F (never bare 0x0F, which wedges the pedal)', () => {
    expect(dumpRequestMessage()).toEqual([0xf0, 0x00, 0x20, 0x32, 0x01, 0x0c, 0x4f, 0xf7]);
    expect(dumpRequestMessage(0x03)[4]).toBe(0x03);
    expect(dumpRequestMessage()[6]).not.toBe(0x0f);
  });

  it('version request uses function 0x40', () => {
    expect(versionRequestMessage()).toEqual([0xf0, 0x00, 0x20, 0x32, 0x01, 0x0c, 0x40, 0xf7]);
  });

  it('requests are not themselves mistaken for a dump', () => {
    expect(isFcbDump(dumpRequestMessage())).toBe(false);
    expect(isFcbDump(versionRequestMessage())).toBe(false);
  });
});

describe('parseVersionResponse', () => {
  const reply = (ver: number, fam: number) => [0xf0, 0x00, 0x20, 0x32, 0x01, 0x0c, ver, fam, 0xf7];

  it('decodes UnO 1.0.3 and 1.0.2f (family 0x0F/0x1F)', () => {
    expect(parseVersionResponse(reply(3, 0x0f))).toMatchObject({
      firmware: 'UnO',
      version: '1.0.3',
      isUno103OrLater: true,
    });
    expect(parseVersionResponse(reply(2, 0x1f))).toMatchObject({
      firmware: 'UnO',
      version: '1.0.2f',
      isUno103OrLater: false,
    });
  });

  it('decodes UnO version codes (family 0x0E and offset family 0x1E)', () => {
    expect(parseVersionResponse(reply(9, 0x0e))).toMatchObject({
      firmware: 'UnO',
      version: '1.0.4',
      isUno103OrLater: true,
    });
    expect(parseVersionResponse(reply(8, 0x0e))).toMatchObject({ version: '1.0.3', isUno103OrLater: true });
    expect(parseVersionResponse(reply(7, 0x0e))).toMatchObject({ version: '1.0.2f', isUno103OrLater: false });
    expect(parseVersionResponse(reply(3, 0x1e))).toMatchObject({ version: '1.0.3', isUno103OrLater: true });
  });

  it('decodes stock Behringer firmware (family 0x0D)', () => {
    expect(parseVersionResponse(reply(28, 0x0d))).toMatchObject({
      firmware: 'Behringer',
      version: '2.4.1C',
      isUno103OrLater: false,
    });
    expect(parseVersionResponse(reply(30, 0x0d))).toMatchObject({ firmware: 'Behringer', version: '2.5' });
  });

  it('rejects non-version messages', () => {
    expect(parseVersionResponse(dumpRequestMessage())).toBeNull();
    expect(parseVersionResponse(reply(3, 0x22))).toBeNull();
    expect(parseVersionResponse([0xf0, 0xf7])).toBeNull();
    expect(parseVersionResponse(syntheticDump())).toBeNull();
  });

  it('accepts any device id at byte 4', () => {
    const bytes = reply(3, 0x0f);
    bytes[4] = 0x00;
    expect(parseVersionResponse(bytes)).not.toBeNull();
  });
});

describe('pack/unpack', () => {
  it('round-trips a synthetic dump byte-for-byte', () => {
    const dump = syntheticDump();
    const memory = unpackDump(dump);
    expect(memory.length).toBe(MEMORY_SIZE);
    const repacked = packDump(memory, dump[4]);
    expect(Array.from(repacked)).toEqual(Array.from(dump));
  });

  it('reconstructs MSBs from the 8th byte of each run', () => {
    const dump = syntheticDump();
    // First run: data bytes at 7-13, MSB byte at 14. Set MSB bit for the 3rd byte.
    dump.fill(0, 7, 15);
    dump[9] = 0x05;
    dump[14] = 0b0000100;
    const memory = unpackDump(dump);
    expect(memory[2]).toBe(0x85);
    expect(memory[0]).toBe(0);
  });

  it('round-trips through the model default memory', () => {
    const memory = createDefaultMemory();
    const again = unpackDump(packDump(memory));
    expect(Array.from(again)).toEqual(Array.from(memory));
  });
});

describe('preset accessors', () => {
  it('reads what it writes, for every preset slot', () => {
    const memory = createDefaultMemory();
    const preset = {
      pc: [
        { enabled: true, program: 12 },
        { enabled: false, program: 34 },
        { enabled: true, program: 56 },
        { enabled: false, program: 78 },
        { enabled: true, program: 90 },
      ],
      cc1: { enabled: true, controller: 80, value: 127 },
      cc2: { enabled: false, controller: 81, value: 0 },
      switch1: true,
      switch2: false,
      expA: { enabled: true, controller: 27, min: 10, max: 120 },
      expB: { enabled: false, controller: 7, min: 0, max: 127 },
      note: { enabled: true, value: 60 },
    } as const;
    setPreset(memory, 42, structuredClone(preset) as Parameters<typeof setPreset>[2]);
    expect(getPreset(memory, 42)).toEqual(preset);
  });

  it('does not touch neighbouring presets', () => {
    const memory = createDefaultMemory();
    const before41 = getPreset(memory, 41);
    const before43 = getPreset(memory, 43);
    const edited = getPreset(memory, 42);
    edited.cc1 = { enabled: true, controller: 99, value: 99 };
    setPreset(memory, 42, edited);
    expect(getPreset(memory, 41)).toEqual(before41);
    expect(getPreset(memory, 43)).toEqual(before43);
  });

  it('preserves unknown bytes (UnO extension area) across edits', () => {
    const dump = syntheticDump();
    const memory = unpackDump(dump);
    const extensionBefore = Array.from(memory.slice(1600, 2016));
    const preset = getPreset(memory, 0);
    preset.pc[0] = { enabled: true, program: 1 };
    setPreset(memory, 0, preset);
    setGlobal(memory, { ...getGlobal(memory), directSelect: true });
    expect(Array.from(memory.slice(1600, 2016))).toEqual(extensionBefore);
  });

  it('rejects out-of-range indexes', () => {
    const memory = createDefaultMemory();
    expect(() => getPreset(memory, -1)).toThrow();
    expect(() => getPreset(memory, 100)).toThrow();
  });
});

describe('global accessors', () => {
  it('reads what it writes', () => {
    const memory = createDefaultMemory();
    const global = {
      channels: { pc1: 1, pc2: 2, pc3: 3, pc4: 4, pc5: 5, cc1: 6, cc2: 7, expA: 8, expB: 9, note: 15 },
      directSelect: true,
      runningStatus: false,
      midiMerge: true,
      switch1: true,
      switch2: true,
      expACalibrationMin: 5,
      expACalibrationMax: 120,
      expBCalibrationMin: 10,
      expBCalibrationMax: 100,
    };
    setGlobal(memory, global);
    expect(getGlobal(memory)).toEqual(global);
  });

  it('default memory matches expected defaults', () => {
    const memory = createDefaultMemory();
    const global = getGlobal(memory);
    expect(global.runningStatus).toBe(true);
    expect(global.directSelect).toBe(false);
    const preset0 = getPreset(memory, 0);
    expect(preset0.pc[0]).toEqual({ enabled: true, program: 0 });
    const preset99 = getPreset(memory, 99);
    expect(preset99.pc[0]).toEqual({ enabled: true, program: 99 });
    expect(preset99.expA.enabled).toBe(true);
  });
});

describe('presetLabel', () => {
  it('formats bank and pedal', () => {
    expect(presetLabel(0)).toBe('00-1');
    expect(presetLabel(9)).toBe('00-10');
    expect(presetLabel(42)).toBe('04-3');
    expect(presetLabel(99)).toBe('09-10');
  });
});
