# FCB1010 UNO Editor

Web-based editor for the Behringer FCB1010 MIDI foot controller running the
[UNO firmware](https://www.fcb1010.eu/) — in the spirit of
[fcb1010.online](https://fcb1010.online/), but targeting UNO (and eventually UNO2).

No backend — everything runs in the browser via the Web MIDI API
(Chrome / Edge / Chromium-based browsers).

## Status

MVP: MIDI monitor. Connect the FCB1010, pick an input, press footswitches and
watch decoded messages (PC / CC / notes / sysex) with raw hex.

Planned:

- Preset editing (sysex dump read / edit / write) for UNO 1.x
- Global setup (channels, stompbox mode, expression pedals)
- UNO2 support behind the same device abstraction

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
