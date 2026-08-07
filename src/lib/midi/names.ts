/** Standard MIDI names: controller (CC) assignments per the MMA spec, and note pitches. */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note number to scientific pitch, middle C (60) = C4. */
export function noteName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  return `${NOTE_NAMES[note % 12]}${octave}`;
}

/** Standard controller names; unnamed CCs are absent. */
export const CC_NAMES: Record<number, string> = {
  0: 'Bank Select',
  1: 'Mod Wheel',
  2: 'Breath',
  4: 'Foot Controller',
  5: 'Portamento Time',
  6: 'Data Entry',
  7: 'Volume',
  8: 'Balance',
  10: 'Pan',
  11: 'Expression',
  12: 'Effect Control 1',
  13: 'Effect Control 2',
  16: 'General Purpose 1',
  17: 'General Purpose 2',
  18: 'General Purpose 3',
  19: 'General Purpose 4',
  32: 'Bank Select LSB',
  33: 'Mod Wheel LSB',
  34: 'Breath LSB',
  36: 'Foot Controller LSB',
  37: 'Portamento Time LSB',
  38: 'Data Entry LSB',
  39: 'Volume LSB',
  40: 'Balance LSB',
  42: 'Pan LSB',
  43: 'Expression LSB',
  44: 'Effect Control 1 LSB',
  45: 'Effect Control 2 LSB',
  64: 'Sustain Pedal',
  65: 'Portamento On/Off',
  66: 'Sostenuto',
  67: 'Soft Pedal',
  68: 'Legato',
  69: 'Hold 2',
  70: 'Sound Variation',
  71: 'Resonance',
  72: 'Release Time',
  73: 'Attack Time',
  74: 'Brightness / Cutoff',
  75: 'Decay Time',
  76: 'Vibrato Rate',
  77: 'Vibrato Depth',
  78: 'Vibrato Delay',
  80: 'General Purpose 5',
  81: 'General Purpose 6',
  82: 'General Purpose 7',
  83: 'General Purpose 8',
  84: 'Portamento Control',
  88: 'High-Res Velocity',
  91: 'Reverb Send',
  92: 'Tremolo Depth',
  93: 'Chorus Send',
  94: 'Detune Depth',
  95: 'Phaser Depth',
  96: 'Data Increment',
  97: 'Data Decrement',
  98: 'NRPN LSB',
  99: 'NRPN MSB',
  100: 'RPN LSB',
  101: 'RPN MSB',
  120: 'All Sound Off',
  121: 'Reset All Controllers',
  122: 'Local Control',
  123: 'All Notes Off',
  124: 'Omni Mode Off',
  125: 'Omni Mode On',
  126: 'Mono Mode',
  127: 'Poly Mode',
};

export interface MidiPickerItem {
  value: number;
  /** Display label, e.g. "7 · Volume" or "C4 · 60". */
  label: string;
  /** Extra search keywords beyond the label (the picker searches both). */
  keywords: string[];
}

const range128 = Array.from({ length: 128 }, (_, i) => i);

/** All 128 controllers: "7 · Volume" for named CCs, "27" for unnamed ones. */
export const CC_PICKER_ITEMS: readonly MidiPickerItem[] = range128.map((value) => {
  const name = CC_NAMES[value];
  return {
    value,
    label: name ? `${value} · ${name}` : `${value}`,
    keywords: [`cc${value}`, `cc ${value}`],
  };
});

/** All 128 notes as "C4 · 60", searchable by pitch name or number. */
export const NOTE_PICKER_ITEMS: readonly MidiPickerItem[] = range128.map((value) => ({
  value,
  label: `${noteName(value)} · ${value}`,
  keywords: [],
}));
