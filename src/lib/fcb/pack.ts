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
 * Short command message: `F0 00 20 32 <dev> 0C <fn> F7`. Function bytes
 * (reverse-engineered from FCB/UnO ControlCenter): 0x40 = firmware version
 * request, 0x4F = patchdump upload request, 0x50+n = request chunk n of a
 * chunked upload. 0x0F must NEVER be sent bare — it is the patchdump
 * function itself, and a data-less dump header puts the pedal into
 * sysex-receive mode where it stops sending MIDI until power-cycled.
 */
function commandMessage(fn: number, deviceId: number): number[] {
  const message = [...HEADER, 0xf7];
  message[4] = deviceId & 0x7f;
  message[6] = fn & 0x7f;
  return message;
}

/**
 * Patchdump upload request (function 0x4F). UnO firmware responds with a
 * full 2352-byte patchdump (ControlCenter allows 30s for it); stock
 * firmware ignores it and requires the manual foot-switch transmit
 * procedure instead.
 */
export function dumpRequestMessage(deviceId = 0x01): number[] {
  return commandMessage(0x4f, deviceId);
}

/**
 * Firmware version request (function 0x40). UnO and LG firmware reply with
 * a 9-byte sysex (see parseVersionResponse); stock Behringer firmware does
 * not reply at all — ControlCenter treats 5s of silence as "not UnO".
 */
export function versionRequestMessage(deviceId = 0x01): number[] {
  return commandMessage(0x40, deviceId);
}

export interface FirmwareInfo {
  /** Firmware family: UnO (fcb1010.uno) or the LG custom firmware. */
  firmware: 'UnO' | 'LG';
  /** Human-readable version, e.g. "1.0.3". */
  version: string;
  /** UnO >= 1.0.3: auto-answers dump requests, acks received dumps, chunked protocol. */
  isUno103OrLater: boolean;
  raw: number[];
}

/**
 * Parse the reply to versionRequestMessage: `F0 00 20 32 <dev> 0C <ver> <fam> F7`.
 * Byte 7 selects the firmware family, byte 6 the version. Decoding mirrors
 * ControlCenter's parser: family 0x0F/0x1F is UnO (ver 3 = 1.0.3, else
 * 1.0.2f), family 0x0E is UnO with ver as the patch digit (4 = 1.0.4),
 * family 0x1E is UnO 1.0.2 pre-release builds, family 0x0D is LG firmware.
 * Returns null for anything that is not a version reply.
 */
export function parseVersionResponse(data: readonly number[] | Uint8Array): FirmwareInfo | null {
  if (data.length !== 9 || data[8] !== 0xf7) return null;
  for (let i = 0; i < 6; i++) {
    if (i !== 4 && data[i] !== HEADER[i]) return null;
  }
  const ver = data[6];
  const fam = data[7];
  const raw = [...data];
  switch (fam) {
    case 0x0f:
    case 0x1f:
      return ver === 3
        ? { firmware: 'UnO', version: '1.0.3', isUno103OrLater: true, raw }
        : { firmware: 'UnO', version: '1.0.2f', isUno103OrLater: false, raw };
    case 0x0e:
      if (ver <= 9) {
        return { firmware: 'UnO', version: `1.0.${ver}`, isUno103OrLater: ver > 2, raw };
      }
      return { firmware: 'UnO', version: `1.0.2 (code ${ver})`, isUno103OrLater: false, raw };
    case 0x1e:
      return { firmware: 'UnO', version: `1.0.2 (code ${ver})`, isUno103OrLater: false, raw };
    case 0x0d:
      return { firmware: 'LG', version: `2.x (code ${ver})`, isUno103OrLater: false, raw };
    default:
      return null;
  }
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
