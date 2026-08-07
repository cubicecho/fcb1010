import { describe, expect, it } from 'vitest';
import { decodeMidiMessage, noteName, toHex } from './decode';

describe('noteName', () => {
  it('maps middle C (60) to C4', () => {
    expect(noteName(60)).toBe('C4');
  });

  it('maps 0 to C-1 and 127 to G9', () => {
    expect(noteName(0)).toBe('C-1');
    expect(noteName(127)).toBe('G9');
  });
});

describe('toHex', () => {
  it('formats bytes as uppercase hex pairs', () => {
    expect(toHex([0xb0, 0x1b, 0x7f])).toBe('B0 1B 7F');
  });
});

describe('decodeMidiMessage', () => {
  it('decodes program change with channel', () => {
    const message = decodeMidiMessage([0xc0, 5]);
    expect(message.kind).toBe('programchange');
    expect(message.channel).toBe(1);
    expect(message.summary).toBe('PC 5');
  });

  it('decodes control change with controller name', () => {
    const message = decodeMidiMessage([0xb1, 7, 100]);
    expect(message.kind).toBe('controlchange');
    expect(message.channel).toBe(2);
    expect(message.summary).toBe('CC 7 (Volume) = 100');
  });

  it('decodes control change without a name for unnamed controllers', () => {
    const message = decodeMidiMessage([0xb0, 27, 127]);
    expect(message.summary).toBe('CC 27 = 127');
  });

  it('decodes note on and note off', () => {
    expect(decodeMidiMessage([0x90, 60, 64]).kind).toBe('noteon');
    expect(decodeMidiMessage([0x80, 60, 0]).kind).toBe('noteoff');
  });

  it('treats note on with velocity 0 as note off', () => {
    expect(decodeMidiMessage([0x90, 60, 0]).kind).toBe('noteoff');
  });

  it('decodes pitch bend as signed value', () => {
    expect(decodeMidiMessage([0xe0, 0x00, 0x40]).summary).toBe('Pitch Bend 0');
    expect(decodeMidiMessage([0xe0, 0x7f, 0x7f]).summary).toBe('Pitch Bend +8191');
    expect(decodeMidiMessage([0xe0, 0x00, 0x00]).summary).toBe('Pitch Bend -8192');
  });

  it('decodes sysex and identifies Behringer manufacturer id', () => {
    const message = decodeMidiMessage([0xf0, 0x00, 0x20, 0x32, 0x01, 0x0c, 0xf7]);
    expect(message.kind).toBe('sysex');
    expect(message.summary).toContain('Behringer');
    expect(message.summary).toContain('7 bytes');
  });

  it('decodes realtime messages without a channel', () => {
    const clock = decodeMidiMessage([0xf8]);
    expect(clock.kind).toBe('clock');
    expect(clock.channel).toBeUndefined();
  });

  it('returns unknown for garbage input', () => {
    expect(decodeMidiMessage([]).kind).toBe('unknown');
    expect(decodeMidiMessage([0x12]).kind).toBe('unknown');
  });
});
