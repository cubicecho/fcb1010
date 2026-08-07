/**
 * Typed accessors over the FCB1010 internal memory image (see docs/sysex-format.md).
 *
 * The memory image is the source of truth: accessors read/write only the
 * bytes they understand, so anything we don't model yet (the UnO extension
 * area in particular) survives a load → edit → save round trip untouched.
 */

import { MEMORY_SIZE } from './pack';

export const PRESET_COUNT = 100;
export const PRESET_SIZE = 16;
export const BANK_COUNT = 10;
export const PRESETS_PER_BANK = 10;

const GLOBAL_CHANNELS = 2016;
const GLOBAL_CHANNELS_COPY = 2034;
const GLOBAL_SWITCH_BYTE = 2032;
const GLOBAL_CONFIG_BYTE = 2033;
const GLOBAL_CALIBRATION = 2044;

/** The ten independently-channelled MIDI functions, in memory order. */
export const MIDI_FUNCTIONS = ['pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'cc1', 'cc2', 'expA', 'expB', 'note'] as const;
export type MidiFunction = (typeof MIDI_FUNCTIONS)[number];

export interface ProgramChangeSlot {
  enabled: boolean;
  /** 0-127 */
  program: number;
}

export interface ControlChangeSlot {
  enabled: boolean;
  /** 0-127 */
  controller: number;
  /** 0-127 */
  value: number;
}

export interface ExpressionSlot {
  enabled: boolean;
  /** 0-127 */
  controller: number;
  /** 0-127 */
  min: number;
  /** 0-127 */
  max: number;
}

export interface NoteSlot {
  enabled: boolean;
  /** 0-127 */
  value: number;
}

export interface FcbPreset {
  /** PC1-PC5 */
  pc: [ProgramChangeSlot, ProgramChangeSlot, ProgramChangeSlot, ProgramChangeSlot, ProgramChangeSlot];
  cc1: ControlChangeSlot;
  cc2: ControlChangeSlot;
  switch1: boolean;
  switch2: boolean;
  expA: ExpressionSlot;
  expB: ExpressionSlot;
  note: NoteSlot;
}

export interface FcbGlobal {
  /** MIDI channel 0-15 per function. */
  channels: Record<MidiFunction, number>;
  directSelect: boolean;
  runningStatus: boolean;
  midiMerge: boolean;
  switch1: boolean;
  switch2: boolean;
  expACalibrationMin: number;
  expACalibrationMax: number;
  expBCalibrationMin: number;
  expBCalibrationMax: number;
}

function assertPresetIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= PRESET_COUNT) {
    throw new Error(`Preset index out of range: ${index}`);
  }
}

const value7 = (byte: number) => byte & 0x7f;
const msb = (byte: number) => (byte & 0x80) !== 0;
/** Compose a byte from a 7-bit value and its top "disabled" (or flag) bit. */
const withFlag = (value: number, flag: boolean) => (value & 0x7f) | (flag ? 0x80 : 0);

export function getPreset(memory: Uint8Array, index: number): FcbPreset {
  assertPresetIndex(index);
  const p = index * PRESET_SIZE;
  const pcSlot = (offset: number): ProgramChangeSlot => ({
    enabled: !msb(memory[p + offset]),
    program: value7(memory[p + offset]),
  });
  return {
    pc: [pcSlot(0), pcSlot(1), pcSlot(2), pcSlot(3), pcSlot(4)],
    cc1: {
      enabled: !msb(memory[p + 5]),
      controller: value7(memory[p + 5]),
      value: value7(memory[p + 6]),
    },
    cc2: {
      enabled: !msb(memory[p + 7]),
      controller: value7(memory[p + 7]),
      value: value7(memory[p + 8]),
    },
    switch1: msb(memory[p + 6]),
    switch2: msb(memory[p + 8]),
    expA: {
      enabled: !msb(memory[p + 9]),
      controller: value7(memory[p + 9]),
      min: value7(memory[p + 10]),
      max: value7(memory[p + 11]),
    },
    expB: {
      enabled: !msb(memory[p + 12]),
      controller: value7(memory[p + 12]),
      min: value7(memory[p + 13]),
      max: value7(memory[p + 14]),
    },
    note: {
      enabled: !msb(memory[p + 15]),
      value: value7(memory[p + 15]),
    },
  };
}

/** Write a preset into the memory image (mutates `memory`). */
export function setPreset(memory: Uint8Array, index: number, preset: FcbPreset): void {
  assertPresetIndex(index);
  const p = index * PRESET_SIZE;
  preset.pc.forEach((slot, i) => {
    memory[p + i] = withFlag(slot.program, !slot.enabled);
  });
  memory[p + 5] = withFlag(preset.cc1.controller, !preset.cc1.enabled);
  memory[p + 6] = withFlag(preset.cc1.value, preset.switch1);
  memory[p + 7] = withFlag(preset.cc2.controller, !preset.cc2.enabled);
  memory[p + 8] = withFlag(preset.cc2.value, preset.switch2);
  memory[p + 9] = withFlag(preset.expA.controller, !preset.expA.enabled);
  memory[p + 10] = (memory[p + 10] & 0x80) | (preset.expA.min & 0x7f);
  memory[p + 11] = (memory[p + 11] & 0x80) | (preset.expA.max & 0x7f);
  memory[p + 12] = withFlag(preset.expB.controller, !preset.expB.enabled);
  memory[p + 13] = (memory[p + 13] & 0x80) | (preset.expB.min & 0x7f);
  memory[p + 14] = (memory[p + 14] & 0x80) | (preset.expB.max & 0x7f);
  memory[p + 15] = withFlag(preset.note.value, !preset.note.enabled);
}

export function getGlobal(memory: Uint8Array): FcbGlobal {
  const channels = {} as Record<MidiFunction, number>;
  MIDI_FUNCTIONS.forEach((fn, i) => {
    channels[fn] = value7(memory[GLOBAL_CHANNELS + i]) & 0x0f;
  });
  return {
    channels,
    directSelect: (memory[GLOBAL_CONFIG_BYTE] & 0x02) !== 0,
    runningStatus: (memory[GLOBAL_CONFIG_BYTE] & 0x04) !== 0,
    midiMerge: (memory[GLOBAL_CONFIG_BYTE] & 0x10) !== 0,
    switch1: msb(memory[GLOBAL_SWITCH_BYTE]),
    switch2: (memory[GLOBAL_SWITCH_BYTE] & 0x40) !== 0,
    expACalibrationMin: value7(memory[GLOBAL_CALIBRATION]),
    expACalibrationMax: value7(memory[GLOBAL_CALIBRATION + 1]),
    expBCalibrationMin: value7(memory[GLOBAL_CALIBRATION + 2]),
    expBCalibrationMax: value7(memory[GLOBAL_CALIBRATION + 3]),
  };
}

/** Write global config into the memory image (mutates `memory`). */
export function setGlobal(memory: Uint8Array, global: FcbGlobal): void {
  MIDI_FUNCTIONS.forEach((fn, i) => {
    const channel = global.channels[fn] & 0x0f;
    memory[GLOBAL_CHANNELS + i] = (memory[GLOBAL_CHANNELS + i] & 0x80) | channel;
    memory[GLOBAL_CHANNELS_COPY + i] = (memory[GLOBAL_CHANNELS_COPY + i] & 0x80) | channel;
  });
  let configByte = memory[GLOBAL_CONFIG_BYTE] & ~(0x02 | 0x04 | 0x10);
  if (global.directSelect) configByte |= 0x02;
  if (global.runningStatus) configByte |= 0x04;
  if (global.midiMerge) configByte |= 0x10;
  memory[GLOBAL_CONFIG_BYTE] = configByte;
  let switchByte = memory[GLOBAL_SWITCH_BYTE] & ~(0x40 | 0x80);
  if (global.switch1) switchByte |= 0x80;
  if (global.switch2) switchByte |= 0x40;
  memory[GLOBAL_SWITCH_BYTE] = switchByte;
  memory[GLOBAL_CALIBRATION] = (memory[GLOBAL_CALIBRATION] & 0x80) | (global.expACalibrationMin & 0x7f);
  memory[GLOBAL_CALIBRATION + 1] = (memory[GLOBAL_CALIBRATION + 1] & 0x80) | (global.expACalibrationMax & 0x7f);
  memory[GLOBAL_CALIBRATION + 2] = (memory[GLOBAL_CALIBRATION + 2] & 0x80) | (global.expBCalibrationMin & 0x7f);
  memory[GLOBAL_CALIBRATION + 3] = (memory[GLOBAL_CALIBRATION + 3] & 0x80) | (global.expBCalibrationMax & 0x7f);
}

/**
 * A fresh memory image resembling factory defaults: each preset sends its
 * own number as PC1 and has both expression pedals active, everything else
 * off. The UnO extension area is filled with 0xFF like a factory dump.
 */
export function createDefaultMemory(): Uint8Array {
  const memory = new Uint8Array(MEMORY_SIZE);
  // Unused / UnO extension area reads as all-ones in factory dumps.
  memory.fill(0xff, PRESET_COUNT * PRESET_SIZE, GLOBAL_CHANNELS);
  for (let i = 0; i < PRESET_COUNT; i++) {
    setPreset(memory, i, {
      pc: [
        { enabled: true, program: i },
        { enabled: false, program: 0 },
        { enabled: false, program: 0 },
        { enabled: false, program: 0 },
        { enabled: false, program: 0 },
      ],
      cc1: { enabled: false, controller: 0, value: 0 },
      cc2: { enabled: false, controller: 0, value: 0 },
      switch1: false,
      switch2: false,
      expA: { enabled: true, controller: 27, min: 0, max: 127 },
      expB: { enabled: true, controller: 7, min: 0, max: 127 },
      note: { enabled: false, value: 60 },
    });
  }
  setGlobal(memory, {
    channels: {
      pc1: 0,
      pc2: 0,
      pc3: 0,
      pc4: 0,
      pc5: 0,
      cc1: 0,
      cc2: 0,
      expA: 0,
      expB: 0,
      note: 0,
    },
    directSelect: false,
    runningStatus: true,
    midiMerge: false,
    switch1: false,
    switch2: false,
    expACalibrationMin: 0,
    expACalibrationMax: 127,
    expBCalibrationMin: 0,
    expBCalibrationMax: 127,
  });
  return memory;
}

/** Display helpers: bank 00-09, pedal 1-10. */
export function presetLabel(index: number): string {
  const bank = Math.floor(index / PRESETS_PER_BANK);
  const pedal = (index % PRESETS_PER_BANK) + 1;
  return `${String(bank).padStart(2, '0')}-${pedal}`;
}
