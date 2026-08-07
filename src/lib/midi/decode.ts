import type { DecodedMidiMessage, MidiMessageKind } from './types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note number to scientific pitch, middle C (60) = C4. */
export function noteName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  return `${NOTE_NAMES[note % 12]}${octave}`;
}

const CC_NAMES: Record<number, string> = {
  0: 'Bank Select',
  1: 'Mod Wheel',
  2: 'Breath',
  4: 'Foot Controller',
  5: 'Portamento Time',
  7: 'Volume',
  10: 'Pan',
  11: 'Expression',
  32: 'Bank Select LSB',
  64: 'Sustain',
  65: 'Portamento',
  66: 'Sostenuto',
  67: 'Soft Pedal',
  120: 'All Sound Off',
  121: 'Reset Controllers',
  123: 'All Notes Off',
};

/** Well-known sysex manufacturer ids (only ones we care about here). */
const MANUFACTURERS: Record<string, string> = {
  '00-20-32': 'Behringer',
  '7d': 'Non-commercial',
  '7e': 'Universal Non-realtime',
  '7f': 'Universal Realtime',
};

export function toHex(data: readonly number[]): string {
  return data.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function sysexManufacturer(data: readonly number[]): string | undefined {
  if (data.length < 2) return undefined;
  const key =
    data[1] === 0x00 && data.length >= 4
      ? [data[1], data[2], data[3]].map((b) => b.toString(16).padStart(2, '0')).join('-')
      : data[1].toString(16).padStart(2, '0');
  return MANUFACTURERS[key];
}

export function decodeMidiMessage(data: readonly number[]): DecodedMidiMessage {
  const status = data[0];

  if (status === undefined || status < 0x80) {
    return { kind: 'unknown', summary: `Unknown (${toHex(data)})`, data };
  }

  // System messages (0xF0-0xFF)
  if (status >= 0xf0) {
    return decodeSystemMessage(status, data);
  }

  // Channel voice messages
  const channel = (status & 0x0f) + 1;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;

  switch (status & 0xf0) {
    case 0x80:
      return { kind: 'noteoff', channel, summary: `Note Off ${noteName(d1)} vel ${d2}`, data };
    case 0x90:
      if (d2 === 0) {
        return { kind: 'noteoff', channel, summary: `Note Off ${noteName(d1)} (vel 0)`, data };
      }
      return { kind: 'noteon', channel, summary: `Note On ${noteName(d1)} vel ${d2}`, data };
    case 0xa0:
      return { kind: 'polyaftertouch', channel, summary: `Poly AT ${noteName(d1)} = ${d2}`, data };
    case 0xb0: {
      const name = CC_NAMES[d1];
      return { kind: 'controlchange', channel, summary: `CC ${d1}${name ? ` (${name})` : ''} = ${d2}`, data };
    }
    case 0xc0:
      return { kind: 'programchange', channel, summary: `PC ${d1}`, data };
    case 0xd0:
      return { kind: 'channelaftertouch', channel, summary: `Channel AT = ${d1}`, data };
    case 0xe0: {
      const value = ((d2 << 7) | d1) - 8192;
      return { kind: 'pitchbend', channel, summary: `Pitch Bend ${value > 0 ? '+' : ''}${value}`, data };
    }
    default:
      return { kind: 'unknown', channel, summary: `Unknown (${toHex(data)})`, data };
  }
}

function decodeSystemMessage(status: number, data: readonly number[]): DecodedMidiMessage {
  switch (status) {
    case 0xf0: {
      const manufacturer = sysexManufacturer(data);
      return {
        kind: 'sysex',
        summary: `SysEx${manufacturer ? ` (${manufacturer})` : ''} ${data.length} bytes`,
        data,
      };
    }
    case 0xf1:
      return { kind: 'mtc', summary: `MTC Quarter Frame ${data[1] ?? 0}`, data };
    case 0xf2: {
      const position = (((data[2] ?? 0) << 7) | (data[1] ?? 0)) as number;
      return { kind: 'songposition', summary: `Song Position ${position}`, data };
    }
    case 0xf3:
      return { kind: 'songselect', summary: `Song Select ${data[1] ?? 0}`, data };
    case 0xf6:
      return { kind: 'tunerequest', summary: 'Tune Request', data };
    case 0xf8:
      return { kind: 'clock', summary: 'Clock', data };
    case 0xfa:
      return { kind: 'start', summary: 'Start', data };
    case 0xfb:
      return { kind: 'continue', summary: 'Continue', data };
    case 0xfc:
      return { kind: 'stop', summary: 'Stop', data };
    case 0xfe:
      return { kind: 'activesensing', summary: 'Active Sensing', data };
    case 0xff:
      return { kind: 'reset', summary: 'System Reset', data };
    default:
      return { kind: 'unknown', summary: `Unknown (${toHex(data)})`, data };
  }
}

const KIND_LABELS: Record<MidiMessageKind, string> = {
  noteoff: 'Note Off',
  noteon: 'Note On',
  polyaftertouch: 'Poly AT',
  controlchange: 'CC',
  programchange: 'PC',
  channelaftertouch: 'Ch AT',
  pitchbend: 'Bend',
  sysex: 'SysEx',
  mtc: 'MTC',
  songposition: 'Song Pos',
  songselect: 'Song Sel',
  tunerequest: 'Tune Req',
  clock: 'Clock',
  start: 'Start',
  continue: 'Continue',
  stop: 'Stop',
  activesensing: 'Act Sense',
  reset: 'Reset',
  unknown: 'Unknown',
};

export function kindLabel(kind: MidiMessageKind): string {
  return KIND_LABELS[kind];
}
