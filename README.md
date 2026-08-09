# FCB1010 UNO Editor

Web-based editor for the Behringer FCB1010 MIDI foot controller running the
[UNO firmware](https://www.fcb1010.eu/) — in the spirit of
[fcb1010.online](https://fcb1010.online/), but targeting UNO (and eventually UNO2).

No backend — everything runs in the browser via the Web MIDI API
(Chrome / Edge / Chromium-based browsers).

## Status

Working editor for UnO 1.x:

- **Monitor** — decoded MIDI in both directions (PC / CC / notes / sysex) with
  raw hex, pause/resume, and direction + message-type filters.
- **Presets** — bank/pedal grid mirroring the physical board; per-preset editing
  of the five PC slots, CC1/CC2, expression pedals A/B, note, and switches.
  Searchable pickers show standard MIDI names ("CC 7 · Volume", "C4 · 60").
  Copy/paste/clear, undo/redo (Ctrl+Z / Ctrl+Shift+Z), and local preset names.
- **Setup** — global MIDI channels per function, direct select, running status,
  MIDI merge, switches, expression pedal calibration.
- **Transfers** — load/save `.syx` files; receive from and send to the pedal
  over sysex. Sending confirms first, then verifies by reading the dump back
  and byte-comparing. Firmware detection (UnO vs stock Behringer, with
  version) shows as a persistent header badge.

Anything the editor doesn't model yet (the UnO extension area in particular)
survives a load → edit → save round trip untouched. The reverse-engineered
sysex protocol (2352-byte dump format, 7-bit packing, UnO commands) is
documented in [docs/sysex-format.md](docs/sysex-format.md).

Planned:

- UnO extension-area fields (stompbox mode, etc.)
- UNO2 support behind the same device abstraction
- Chunked dump protocol for UnO ≥ 1.0.3 (for flaky USB-MIDI interfaces)

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 + shadcn/ui
- TanStack Router (file-based routes in `src/routes/`)
- [webmidi.js](https://webmidijs.org/) for port management (decoding is our own, `src/lib/midi/decode.ts`)
- Biome for lint/format, Vitest for tests

## Development

```sh
npm install
npm run dev        # dev server on http://localhost:3000
npm run check      # biome + typecheck
npm test           # vitest
npm run build      # production build to dist/
```
