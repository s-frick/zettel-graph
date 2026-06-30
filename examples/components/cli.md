---
type: Component
title: CLI
description: zettel-graph command-line entrypoint (dev / build / graph).
tags: [cli, vite]
resource: bin/cli.js
timestamp: 2026-06-30
---

# CLI

`bin/cli.js` is the entrypoint. `dev` starts a Vite server with hot-reload,
`build` emits a static site, and `graph` writes `graph.json`. It pins the Vite
root to the package and points the [parser](/components/parser.md) at whatever
bundle directory you pass.

Renders a [force-directed graph](/concepts/force-directed-graph.md). See
[configuration](/guides/configuration.md) for the available options.
