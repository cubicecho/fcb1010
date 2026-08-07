# FCB1010 sysex dump format

Sources: the FCB1010 sysex structure spec (Behringer, widely mirrored), the
MIT-licensed reverse-engineered parser at
[riban-bw/fcb1010](https://github.com/riban-bw/fcb1010), and the
[FCB/UnO ControlCenter manual](https://www.fcb1010.uno/downloads/FCB_UnO_ControlCenter_manual.pdf).

## Wire format

A full patchdump is **2352 bytes**:

| Offset | Bytes | Meaning |
| ------ | ----- | ------- |
| 0      | `F0`  | sysex start |
| 1-3    | `00 20 32` | Behringer manufacturer id |
| 4      | `01`  | device id |
| 5      | `0C`  | model id (FCB1010) |
| 6      | `0F`  | function: patchdump |
| 7-2350 | data  | 2344 bytes, 7-bit packed (see below) |
| 2351   | `F7`  | sysex end |

### 7-bit packing

The FCB1010's internal memory is 8-bit, but MIDI data bytes are 7-bit. The
dump encodes each run of 7 memory bytes as 8 wire bytes: 7 data bytes
(low 7 bits) followed by one **MSB byte** whose bit *i* is the top bit of the
*i*-th data byte in the run. 2344 wire bytes = 293 runs = **2051 bytes of
internal memory**.

All offsets below are in *internal memory* space (after unpacking).

## Internal memory map (stock firmware v2.5 / UnO shared core)

### Presets — offsets 0-1599

100 presets (bank 00-09 × pedal 1-10), 16 bytes each. Preset `n` starts at
`n * 16`. The top bit of a byte is that function's **disable** flag
(1 = disabled) unless noted.

| Byte | Meaning | Top bit |
| ---- | ------- | ------- |
| 0    | PC1 program | PC1 disabled |
| 1    | PC2 program | PC2 disabled |
| 2    | PC3 program | PC3 disabled |
| 3    | PC4 program | PC4 disabled |
| 4    | PC5 program | PC5 disabled |
| 5    | CC1 controller | CC1 disabled |
| 6    | CC1 value | **switch 1 enabled** (not inverted) |
| 7    | CC2 controller | CC2 disabled |
| 8    | CC2 value | **switch 2 enabled** (not inverted) |
| 9    | ExpA controller | ExpA disabled |
| 10   | ExpA min | – |
| 11   | ExpA max | – |
| 12   | ExpB controller | ExpB disabled |
| 13   | ExpB min | – |
| 14   | ExpB max | – |
| 15   | Note value | Note disabled |

### UnO extension area — offsets 1600-2015

Unused by stock firmware (factory dumps fill it with `7F`/`FF`). UnO stores
its extra per-preset data here (alternate CC values, stompbox states,
momentary release values) — **layout not publicly documented**. We preserve
these bytes verbatim; UnO fields will be mapped incrementally by diffing real
dumps.

### Global configuration — offsets 2016-2050

| Offset | Meaning |
| ------ | ------- |
| 2016-2025 | MIDI channel (0-15) for PC1, PC2, PC3, PC4, PC5, CC1, CC2, ExpA, ExpB, Note |
| 2032 | bit 6: switch 2 config, bit 7: switch 1 config |
| 2033 | bit 1: direct select, bit 2: running status, bit 4: MIDI merge |
| 2034-2043 | second copy of the 10 MIDI channels (kept in sync on write) |
| 2044 | ExpA calibration min |
| 2045 | ExpA calibration max |
| 2046 | ExpB calibration min |
| 2047 | ExpB calibration max |

## Request commands

Reverse-engineered from the official FCB/UnO ControlCenter binary (its sysex
generator builds `F0 00 20 32 01 0C <fn> F7` from a constant pool
`4F 40 10 0F F7`). Timeouts are ControlCenter's own.

| Message | Meaning |
| ------- | ------- |
| `F0 00 20 32 <dev> 0C 4F F7` | **Patchdump upload request.** The pedal answers with a full 2352-byte patchdump (30s timeout). ControlCenter uses this for both UnO and stock Behringer firmware; its download flow also re-requests an upload afterwards to verify byte-by-byte. |
| `F0 00 20 32 <dev> 0C 40 F7` | **Firmware version request.** The pedal replies with the 9-byte version message below (5s timeout) — ControlCenter's connection check, with reply decodings for both UnO and stock (v2.x) firmware. Silence means no working two-way MIDI link. |
| `F0 00 20 32 <dev> 0C 5n F7` | Request chunk *n* (0-15) of a chunked upload (`0x50 + n`). 30s timeout. |
| `F0 00 20 32 <dev> 0C 10 …` | Chunked patchdump data message: 16 sysex messages of 160 bytes (128 data bytes each) instead of one 2352-byte dump. |

> **Warning — do not send `F0 00 20 32 <dev> 0C 0F F7`.** `0x0F` is the
> patchdump function itself; a data-less dump header is parsed by the pedal
> as the *start of an incoming dump*, and it sits in sysex-receive mode with
> MIDI output dead until power-cycled. (JSynthLib documents these bytes as a
> dump request — that is wrong for UnO hardware.) On UnO 1.0.3+ the EEPROM
> is only written after a *complete* dump, so no corruption results.

### Version reply format

`F0 00 20 32 <dev> 0C <code> <fam> F7` (9 bytes). Byte 7 (`fam`) selects the
firmware family, byte 6 (`code`) the version:

| `fam` | Firmware | `code` meaning |
| ----- | -------- | -------------- |
| `0F` / `1F` | UnO | `03` → v1.0.3, anything else → v1.0.2f |
| `0E` | UnO | table: 0 → 1.0.0, 1 → 1.0.1, 2–7 → 1.0.2a–f, 8 → 1.0.3, 9 → 1.0.4 |
| `1E` | UnO | same table as `0E`, offset by −5 (code 3 → 1.0.3, 4 → 1.0.4) |
| `0D` | stock Behringer | 5 → 1.0, 13 → 2.1, 14 → 2.2, 18 → 2.3.12, 27–29 → 2.4.1B–D, 30 → 2.5 |

ControlCenter enables the chunked protocol and dump acknowledge only when
firmware is UnO with patch digit > 2 (i.e. v1.0.3+).

ControlCenter's connect sequence actually starts one step earlier: it first
sends `F0 7E 7E 30 F7`, a universal-sysex identity hello for the LG-series
devices it also supports (LGM/LG/LGX — their reply is 11/12/48 bytes and
compared against a separate constant table). The FCB1010 never answers it;
after the 5s timeout ControlCenter falls through to the `0x40` version
request. So `0x40` alone, with no prior handshake, is the correct FCB1010
detection message.

### Manual foot-switch procedures (stock manual §2.7)

- **Transmit dump from pedal**: power on holding DOWN (~2.5s) to enter
  global config, press UP until the CONFIG row LED lights, then press
  **footswitch 6** — the pedal sends the 2352-byte dump. Long-press DOWN to
  exit.
- **Receive dump on stock / UnO ≤ 1.0.2f**: same menu, press **footswitch 7
  (SYSEX RCV)** first to arm reception, then send the dump; afterwards
  long-press DOWN (~3s, display counts 9→0) to store it. UnO 1.0.3+ needs
  none of this — reception is always enabled and storage is automatic.

## UnO notes

- UnO v1.0.3+ auto-receives dumps — no manual "enable sysex" step on the
  pedal (v1.0.2f and older require enabling SysEx Receive first), and the
  pedal sends an acknowledge sysex after receiving a full or partial dump.
- UnO v1.0.4 only changed expression-pedal behaviour (no hysteresis, full
  CC resolution); its sysex protocol is identical to v1.0.3.
- UnO v1.0.3 optionally uses the chunked protocol above (for flaky USB-MIDI
  interfaces). Not yet supported here.
- UnO keeps the full stock preset structure (PC1-5, CC1/2, ExpA/B, Note);
  its extras (stompbox mode, alternate CC values, momentary release) live in
  the extension area above. UnO ≤ v1.0.2f additionally supported note
  transpose, sysex-send slots, and ExpA CC toggling (dropped in 1.0.3 to
  restore PC4).
