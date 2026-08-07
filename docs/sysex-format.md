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

## UnO notes

- UnO v1.0.3+ auto-receives dumps (no manual "enable sysex" step on the pedal).
- UnO v1.0.3 optionally uses a chunked protocol: 16 sysex messages of 160
  bytes instead of one 2352-byte dump (for flaky USB-MIDI interfaces). Not
  yet supported here.
- UnO keeps the full stock preset structure (PC1-5, CC1/2, ExpA/B, Note);
  its extras (stompbox mode, alternate CC values, momentary release) live in
  the extension area above.
