---
type: Decision
title: CLI-first, zero-install
description: Ship as an npx-runnable CLI that points at any directory, so there is nothing to install or configure.
tags: [decision, cli, distribution]
resource: bin/cli.js
timestamp: 2026-06-30
---

# CLI-first, zero-install

zettel-graph is distributed as a CLI meant to be run with `npx zettel-graph
<dir>` — no global install, no project setup.

## Decision

- `npx zettel-graph <dir>` runs straight from npm; `dir` defaults to the current
  directory.
- The package is **self-contained**: [the CLI](/components/cli.md) pins the Vite
  root to the package itself (`PKG_ROOT`) and passes the user's bundle via the
  `OKF_BUNDLE` env var that [the Vite config](/components/vite-config.md) reads.

## Why

- **No friction.** Anyone with Node can visualize an [OKF](/concepts/okf.md)
  bundle without adding a dependency to their own project.
- **Bundle stays clean.** The visualizer code never lives inside the knowledge
  directory; the bundle is just markdown.
- **One tool, many modes.** The same entrypoint also does `build`, `graph`, and
  `init` (see [the init command](/components/init-command.md)).

## Consequence

Pinning the root under `node_modules` (when run via `npx`) required the
`optimizeDeps.entries` workaround documented in
[the Vite config](/components/vite-config.md). The live-reload payoff is covered
in [the Vite/HMR decision](/decisions/vite-hmr.md).
