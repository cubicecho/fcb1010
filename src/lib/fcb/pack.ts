/**
 * FCB1010 sysex wire format: 7-bit packing between the 2352-byte patchdump
 * and the device's 8-bit internal memory image. See docs/sysex-format.md.
 */

export const DUMP_SIZE = 2352;
export const MEMORY_SIZE = 2051;
export const HEADER = [0xf0, 0x00, 0x20, 0x32, 0x01, 0x0c, 0x0f] as const;

const DATA_START = HEADER.length;
const DATA_END = DUMP_SIZE - 1;
const RUN = 8;

/**
 * Patchdump upload request: the dump header with no data, terminated
 * immediately. UnO firmware responds with a full 2352-byte patchdump
 * (this is what ControlCenter's "download" uses); stock firmware ignores
 * it and requires the manual foot-switch transmit procedure instead.
 */
export function dumpRequestMessage(deviceId = 0x01): number[] {
  const message = [...HEADER, 0xf7];
  message[4] = deviceId & 0x7f;
  return message;
}

export function isFcbDump(data: readonly number[] | Uint8Array): boolean {
  if (data.length !== DUMP_SIZE) return false;
  if (data[DUMP_SIZE - 1] !== 0xf7) return false;
  // Byte 4 is the device id; accept any value there.
  return HEADER.every((byte, i) => (i === 4 ? true : data[i] === byte));
}

/** Unpack a 2352-byte sysex dump into the 2051-byte internal memory image. */
export function unpackDump(dump: readonly number[] | Uint8Array): Uint8Array {
  if (!isFcbDump(dump)) {
    throw new Error(`Not an FCB1010 patchdump (${dump.length} bytes)`);
  }
  const memory = new Uint8Array(MEMORY_SIZE);
  let out = 0;
  for (let runStart = DATA_START; runStart < DATA_END; runStart += RUN) {
    const msbByte = dump[runStart + RUN - 1];
    for (let i = 0; i < RUN - 1; i++) {
      const msb = (msbByte >> i) & 1;
      memory[out++] = (dump[runStart + i] & 0x7f) | (msb << 7);
    }
  }
  return memory;
}

/**
 * Pack an internal memory image into a 2352-byte sysex dump.
 * deviceId is byte 4 of the header (preserved from a received dump).
 */
export function packDump(memory: Uint8Array, deviceId = 0x01): Uint8Array {
  if (memory.length !== MEMORY_SIZE) {
    throw new Error(`Internal memory must be ${MEMORY_SIZE} bytes, got ${memory.length}`);
  }
  const dump = new Uint8Array(DUMP_SIZE);
  dump.set(HEADER);
  dump[4] = deviceId & 0x7f;
  let inIndex = 0;
  for (let runStart = DATA_START; runStart < DATA_END; runStart += RUN) {
    let msbByte = 0;
    for (let i = 0; i < RUN - 1; i++) {
      const byte = memory[inIndex++];
      dump[runStart + i] = byte & 0x7f;
      msbByte |= ((byte >> 7) & 1) << i;
    }
    dump[runStart + RUN - 1] = msbByte;
  }
  dump[DUMP_SIZE - 1] = 0xf7;
  return dump;
}
