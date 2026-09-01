# TypeScript Architecture

AirplaneJS was rewritten from CommonJS JavaScript into TypeScript with strict
types and ES modules. This document summarizes the resulting structure,
toolchain, and conventions.

## Toolchain

- **Runtime / package manager:** [bun](https://bun.sh) — installs deps, runs the
  server TypeScript directly, and drives `tsc`/`vite` via `bunx`.
- **Client bundler / dev server:** [Vite](https://vite.dev) — bundles the Leaflet
  client, injects HMR in development, and emits content-hashed assets to
  `dist/client` in production.
- **Compiler:** `tsc` (`typescript`) — type-checks both projects and emits the
  Node server to `dist/`.

## Project layout

```
index.html                 Vite entry (root)
vite.config.ts
tsconfig.base.json         shared compiler options (strict)
tsconfig.server.json       NodeNext, emits to dist/
tsconfig.client.json       bundler resolution, DOM libs, no emit
src/
  shared/types.ts          domain types shared by server + client
  server/
    main.ts                entry: CLI args, routing, Vite middleware (dev)
    router.ts              tiny typed router (replaces `patterns`)
    store.ts               AircraftStore (in-memory aircraft map + prune)
    dump1090.ts            Dump1090Client (SBS TCP feed + parser)
    csv.ts                 streaming CSV→JSON + parseCSVLine
    mime.ts                extension → MIME map
    static.ts              production static file serving + cache headers
    logger.ts              tiny namespaced logger (replaces `debug`)
    handlers/
      data.ts              /airlines, /airports, /routes
      aircrafts.ts         /aircrafts (live JSON from store)
  client/
    main.ts                bootstrap, polling, selection
    state.ts               shared mutable client state + constants
    data.ts                typed fetchJSON<T>
    map.ts                 Leaflet init, airports, geolocation
    aircraft.ts            Aircraft class (marker + trail + render)
    ui.ts                  status, stats, table, info panel
    style.css
data/                      OpenFlights CSVs (fetched by `npm run data`)
dist/                      build output (gitignored)
```

## Shared types (`src/shared/types.ts`)

`AltitudeUnit`, `Airline`, `Airport`, `Route`, `Aircraft` (store state), and
`AircraftDTO` (the `/aircrafts` response shape). The server imports these with
NodeNext `.js` extensions (`../shared/types.js`); the client uses bundler
resolution without extensions.

## Server

- `main.ts` parses CLI flags with a small hand-rolled parser (bun's
  `util.parseArgs` does not support `--no-browser` boolean negation), starts the
  dump1090 client, registers routes, picks a port via `listen(0)`, and runs a
  60s store prune interval.
- In development (`NODE_ENV !== 'production'`) the server dynamically imports
  Vite and serves the client through its middleware (HMR, on-the-fly TS). In
  production it serves `dist/client` through `static.ts`.
- `router.ts` matches `METHOD /path/{param}` patterns and returns typed
  `Handler` functions.
- `csv.ts` streams the OpenFlights CSV files to JSON arrays using a small
  RFC-4180 line parser (no `csv-parser` dependency).

## Client

- Module state lives in `state.ts` (map, selected ICAO, aircraft index, airline
  index, airport sizes).
- `Aircraft` keeps data + flight trail (`trailCoords`) + Leaflet layers, and is
  rendered via `render()`; `main.ts` orchestrates the 2s poll, selection, and
  pruning.
- Leaflet is imported from npm (`import * as L from 'leaflet'`) and bundled by
  Vite, including `leaflet/dist/leaflet.css`.

## Scripts

| Script | Command |
|---|---|
| `dev` | `bun --watch src/server/main.ts` |
| `build` | `bunx vite build && bunx tsc -p tsconfig.server.json` |
| `start` | `NODE_ENV=production bun dist/server/main.js --no-browser` |
| `typecheck` | `bunx tsc` on both configs (`--noEmit`) |
| `test` | `npm run typecheck` |
| `data` | downloads the OpenFlights CSVs |

## API endpoints

`GET /`, `GET /airlines`, `GET /airports`, `GET /routes`, `GET /aircrafts`.
Static assets are served from `dist/client`; `/assets/*` responses carry
`Cache-Control: public, max-age=31536000, immutable`, and `index.html` carries
`no-cache`.

## Performance notes (measured via Chrome DevTools traces)

- LCP ≈ 84–97 ms; TTFB ≈ 1–2 ms.
- CLS 0.18 → **0.00**: the bottom aircraft-list panel previously grew from ~44px
  to 280px when rows arrived, shifting full-width content. It now uses a fixed
  `height` with an internal scroll region.
- Airport markers are created only above the zoom visibility threshold and
  recreated on zoom, cutting the DOM roughly in half (≈25k → ≈11.7k elements).
