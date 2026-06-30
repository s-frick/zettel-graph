---
type: Component
title: Vite config
description: Dev server that builds graph.json on the fly, watches the bundle, and pushes HMR updates.
tags: [vite, dev-server, hmr]
resource: vite.config.js
timestamp: 2026-06-30
---

# Vite config

`vite.config.js` defines the `okf-graph` Vite plugin and config. It bridges
[the parser](/components/okf-parser.md) and [the browser app](/components/browser-app.md),
implementing [the Vite/HMR decision](/decisions/vite-hmr.md).

## Bundle resolution

`BUNDLE` = `OKF_BUNDLE` env var (set by [the CLI](/components/cli.md)), falling
back to the repo's `examples/` for local `npm run dev`.

## Plugin behaviour

| Hook | What it does |
| --- | --- |
| `configureServer` | serves `/graph.json` by calling `buildGraph(BUNDLE)` fresh per request; watches the bundle with `chokidar` and sends a custom `okf:update` HMR event on add/change/unlink |
| `generateBundle` | production build: emits `dist/graph.json` as a static asset next to `index.html` |

Building the graph on the fly (rather than from a cached file) is what makes the
[live hot-reload](/decisions/vite-hmr.md) loop work — the browser refetches
without a full reload (see [ghost nodes](/concepts/ghost-nodes.md) as the visible
result of editing).

## Other config

- `optimizeDeps.entries: ['index.html']` — pins the SPA entry so dep
  pre-bundling still runs when the package lives under `node_modules` (via
  `npx`), which CJS deps like `3d-force-graph` need.
- `resolve.dedupe: ['three']` — forces a single THREE instance so the bloom
  post-processing pass shares the renderer's THREE.
