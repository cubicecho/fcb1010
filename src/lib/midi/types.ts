export type MidiMessageKind =
  | 'noteoff'
  | 'noteon'
  | 'polyaftertouch'
  | 'controlchange'
  | 'programchange'
  | 'channelaftertouch'
  | 'pitchbend'
  | 'sysex'
  | 'mtc'
  | 'songposition'
  | 'songselect'
  | 'tunerequest'
  | 'clock'
  | 'start'
  | 'continue'
  | 'stop'
  | 'activesensing'
  | 'reset'
  | 'unknown';

/** Realtime/system messages that tend to flood a monitor log. */
export const NOISY_KINDS: ReadonlySet<MidiMessageKind> = new Set(['clock', 'activesensing', 'mtc']);

export interface DecodedMidiMessage {
  kind: MidiMessageKind;
  /** 1-16 for channel voice messages, undefined for system messages. */
  channel?: number;
  /** Human readable summary, e.g. "CC 27 = 127" or "PC 5". */
  summary: string;
  /** Raw message bytes. */
  data: readonly number[];
}

export interface MonitorEntry {
  id: number;
  /** Milliseconds since page load (DOMHighResTimeStamp). */
  timestamp: number;
  /** 'in' = received from a port; 'out' = sent by this app (local echo). */
  direction: 'in' | 'out';
  portId: string;
  portName: string;
  message: DecodedMidiMessage;
}
