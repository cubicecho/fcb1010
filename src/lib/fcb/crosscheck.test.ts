/**
 * Cross-validation against an independent implementation.
 *
 * The fixture was generated with the MIT-licensed reverse-engineered parser
 * at https://github.com/riban-bw/fcb1010 (fcb1010.get_raw_sysex()) with the
 * distinctive field values asserted below. If our codec agrees with riban's
 * byte layout on every field AND repacks the dump byte-for-byte, both
 * implementations would have to share the same mistake for an offset bug to
 * slip through.
 */

import { describe, expect, it } from 'vitest';
import ribanDump from './__fixtures__/riban-dump.json';
import { getGlobal, getPreset } from './model';
import { packDump, unpackDump } from './pack';

const dump = ribanDump as number[];

describe('crosscheck against riban-bw/fcb1010', () => {
  const memory = unpackDump(dump);

  it('reads preset fields riban wrote', () => {
    const p0 = getPreset(memory, 0);
    expect(p0.pc[0]).toEqual({ enabled: true, program: 42 });
    expect(p0.cc1).toEqual({ enabled: true, controller: 80, value: 111 });
    expect(p0.switch1).toBe(true);
    expect(p0.pc[1].enabled).toBe(false);

    const p7 = getPreset(memory, 7);
    expect(p7.expA).toEqual({ enabled: true, controller: 55, min: 20, max: 100 });
    expect(p7.note).toEqual({ enabled: true, value: 64 });

    const p99 = getPreset(memory, 99);
    expect(p99.pc[4]).toEqual({ enabled: true, program: 77 });
  });

  it('reads global fields riban wrote', () => {
    const global = getGlobal(memory);
    expect(global.channels.pc1).toBe(3);
    expect(global.channels.note).toBe(9);
    expect(global.directSelect).toBe(true);
    expect(global.runningStatus).toBe(true);
    expect(global.expACalibrationMin).toBe(12);
  });

  it('repacks the riban dump byte-for-byte', () => {
    const repacked = packDump(memory, dump[4]);
    expect(Array.from(repacked)).toEqual(dump);
  });
});
