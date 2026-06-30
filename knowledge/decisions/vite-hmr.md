---
type: Decision
title: Vite + HMR for live reload
description: Use Vite plus chokidar to hot-reload the graph as notes are edited, building graph.json on the fly.
tags: [decision, vite, hmr]
resource: vite.config.js
timestamp: 2026-06-30
---

# Vite + HMR for live reload

The dev experience is built on Vite with a custom HMR event, implemented in
[the Vite config](/components/vite-config.md).

## Decision

- Serve `/graph.json` by running [the parser](/components/okf-parser.md) **fresh
  on every request** rather than from a cached file.
- Watch the bundle with `chokidar` and push a custom `okf:update` HMR event on
  any add/change/unlink.
- [The browser app](/components/browser-app.md) listens for `okf:update` and
  refetches the graph — no full page reload.

## Why build graph.json on the fly

The bundle is the source of truth and changes constantly while authoring. A
cached graph would go stale; building per request guarantees the served graph
always matches the files on disk. The same `buildGraph` also powers the
`generateBundle` hook that emits a static `dist/graph.json` for production.

## Payoff

Editing a note — including filling in a [ghost node](/concepts/ghost-nodes.md) —
updates the 3D view within a tick, which is the whole pitch of the
[CLI-first](/decisions/cli-first.md) tool.
